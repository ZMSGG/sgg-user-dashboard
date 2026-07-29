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
  isUniqueConstraintError,
} from "../../../../server/passport-db";

export const dynamic = "force-dynamic";

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

  const target = await getPlayer(db, grant.discordId);
  if (!target) {
    return jsonError(404, "PLAYER_NOT_FOUND", "対象プレイヤーはまだDiscord連携していません。");
  }

  await ensureIntegrationActor(db, config.actorId);
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
