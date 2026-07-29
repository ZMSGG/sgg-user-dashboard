import {
  adminDiscordIds,
  hasJsonRequestHeader,
  hasRecentAuthentication,
  jsonError,
  readSession,
} from "../../../../server/auth";
import { parseGrantPayload } from "../../../../server/grant-validation";
import {
  appendPointGrantWithAudit,
  getDb,
  getGrantByIdempotencyKey,
  getPlayer,
  getPointBalance,
  grantRequestFingerprint,
  isUniqueConstraintError,
} from "../../../../server/passport-db";

export const dynamic = "force-dynamic";

/**
 * Append-only point grant. Idempotency keys make retries safe; corrections
 * are new negative rows with their own reason, never edits or deletions.
 */
export async function POST(request: Request) {
  if (!hasJsonRequestHeader(request)) {
    return jsonError(403, "BAD_REQUEST_HEADER", "不正なリクエストです。");
  }
  const db = await getDb();
  const session = await readSession(request);
  if (!db || !session) return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");
  if (!(await adminDiscordIds()).has(session.sub)) {
    return jsonError(403, "NOT_ADMIN", "管理者権限がありません。");
  }
  if (!hasRecentAuthentication(session)) {
    return jsonError(
      403,
      "RECENT_AUTH_REQUIRED",
      "安全のため、ログアウト後にDiscordへ再接続してから付与してください。",
    );
  }

  let body: {
    discordId?: unknown;
    amount?: unknown;
    reasonCode?: unknown;
    note?: unknown;
    idempotencyKey?: unknown;
  };
  try {
    body = await request.json() as typeof body;
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

  const requestFingerprint = await grantRequestFingerprint({
    actor: session.sub,
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
      grantedBy: session.sub,
      idempotencyKey: grant.idempotencyKey,
      requestFingerprint,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const existing = await getGrantByIdempotencyKey(db, grant.idempotencyKey);
    if (!existing) throw error;
    const legacyPayloadMatches =
      !existing.requestFingerprint &&
      existing.grantedBy === session.sub &&
      existing.discordId === grant.discordId &&
      existing.amount === grant.amount &&
      existing.currency === grant.currency &&
      existing.reasonCode === grant.reasonCode &&
      existing.note === grant.note;
    if (existing.requestFingerprint !== requestFingerprint && !legacyPayloadMatches) {
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
