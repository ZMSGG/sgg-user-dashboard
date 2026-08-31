import { grantRequestFingerprint, jsonError, playerOsEnv } from "../../../../server/auth";
import { parseGrantPayload } from "../../../../server/grant-validation";
import {
  integrationConfigFromEnv,
  verifyIntegrationRequest,
} from "../../../../server/integration-auth";
import {
  appendPointGrantWithAudit,
  ensureIntegrationActor,
  getDb,
  getGrantByIdempotencyKey,
  getPlayer,
  getPointBalance,
  getRecentIssuanceByActor,
  isUniqueConstraintError,
} from "../../../../server/passport-db";

export const dynamic = "force-dynamic";

/**
 * Bounds on unattended issuance.
 *
 * This endpoint authenticates with a shared secret and nothing else — no
 * session, no admin allowlist, no human in the loop — so whoever holds that
 * secret is the mint. The shared validator's ±1,000,000 ceiling is sized for
 * a reviewed admin correction, not for automation: it allowed unlimited calls
 * of a million each. These three limits keep the automated path within the
 * shape of the campaigns it exists for. A genuine large distribution stays
 * possible through the admin path, where a person is present.
 */
const INTEGRATION_REASON_CODES = new Set([
  "TOURNAMENT_RESULT",
  "TOURNAMENT_STONES",
  "CAMPAIGN_REWARD",
  "LOGIN_REWARD",
  "TESTER_FEEDBACK",
]);
/** Largest single automated award; the biggest real one so far was 226. */
const INTEGRATION_MAX_ABS_AMOUNT = 10_000;
/** Rolling ceiling: the whole first tournament was 1,129 SGP. */
const INTEGRATION_WINDOW_MS = 60 * 60 * 1_000;
const INTEGRATION_WINDOW_MAX_TOTAL = 100_000;

/**
 * Server-to-server point grant for automated campaigns (login rewards,
 * tournament payouts). No cookies are involved: authentication is an
 * HMAC signature over the raw body plus a bounded timestamp, and the same
 * append-only, idempotent ledger rules as the admin endpoint apply.
 */
export async function POST(request: Request) {
  const env = await playerOsEnv();
  const config = integrationConfigFromEnv(env);
  const db = await getDb();
  if (!config || !db) {
    return jsonError(503, "INTEGRATION_NOT_CONFIGURED", "自動付与連携は現在準備中です。");
  }

  const rawBody = await request.text();
  if (rawBody.length > 4096) {
    return jsonError(413, "BODY_TOO_LARGE", "リクエスト本文が大きすぎます。");
  }
  const verification = await verifyIntegrationRequest(
    config.secret,
    request.headers.get("x-sgg-timestamp"),
    request.headers.get("x-sgg-signature"),
    rawBody,
  );
  if (!verification.ok) {
    return jsonError(401, verification.reason, "リクエスト署名を検証できませんでした。");
  }

  let body: Parameters<typeof parseGrantPayload>[0];
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return jsonError(400, "BAD_JSON", "リクエスト本文を読み取れません。");
  }
  const parsed = parseGrantPayload(body);
  if (!parsed.ok) return jsonError(400, parsed.code, parsed.message);
  const grant = parsed.value;

  if (!INTEGRATION_REASON_CODES.has(grant.reasonCode)) {
    return jsonError(
      400,
      "REASON_NOT_AUTOMATABLE",
      "この理由コードは自動付与では使用できません。管理者経路で実行してください。",
    );
  }
  if (Math.abs(grant.amount) > INTEGRATION_MAX_ABS_AMOUNT) {
    return jsonError(
      400,
      "AMOUNT_ABOVE_AUTOMATION_LIMIT",
      "自動付与の1件あたり上限を超えています。管理者経路で実行してください。",
    );
  }

  const target = await getPlayer(db, grant.discordId);
  if (!target) {
    return jsonError(404, "PLAYER_NOT_FOUND", "対象プレイヤーはまだDiscord連携していません。");
  }

  await ensureIntegrationActor(db, config.actorId);

  // Checked before writing, and only for a key that is not already recorded —
  // a retry of an accepted grant must stay idempotent rather than trip the cap.
  const alreadyRecorded = await getGrantByIdempotencyKey(db, grant.idempotencyKey);
  if (!alreadyRecorded) {
    const windowStart = new Date(Date.now() - INTEGRATION_WINDOW_MS).toISOString();
    const issued = await getRecentIssuanceByActor(db, config.actorId, windowStart);
    if (issued + Math.abs(grant.amount) > INTEGRATION_WINDOW_MAX_TOTAL) {
      return jsonError(
        429,
        "ISSUANCE_LIMIT_REACHED",
        "自動付与の一定時間あたりの上限に達しました。時間をおくか管理者経路で実行してください。",
      );
    }
  }
  const requestFingerprint = await grantRequestFingerprint({
    actor: config.actorId,
    discordId: grant.discordId,
    amount: grant.amount,
    currency: grant.currency,
    reasonCode: grant.reasonCode,
    note: grant.note,
  });

  let alreadyGranted = false;
  try {
    await appendPointGrantWithAudit(db, {
      discordId: grant.discordId,
      amount: grant.amount,
      currency: grant.currency,
      reasonCode: grant.reasonCode,
      note: grant.note,
      grantedBy: config.actorId,
      idempotencyKey: grant.idempotencyKey,
      requestFingerprint,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const existing = await getGrantByIdempotencyKey(db, grant.idempotencyKey);
    if (!existing) throw error;
    if (existing.requestFingerprint !== requestFingerprint) {
      return jsonError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "同じ冪等キーが異なる付与内容ですでに使用されています。",
      );
    }
    alreadyGranted = true;
  }

  const balance = await getPointBalance(db, grant.discordId, grant.currency);
  return Response.json(
    { ok: true, alreadyGranted, balance },
    { headers: { "Cache-Control": "no-store" } },
  );
}
