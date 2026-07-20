import {
  adminDiscordIds,
  hasJsonRequestHeader,
  hasRecentAuthentication,
  jsonError,
  readSession,
} from "../../../../server/auth";
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

const REASON_PATTERN = /^[A-Z0-9_]{3,64}$/;
const MAX_ABS_AMOUNT = 1_000_000;

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

  if (typeof body.discordId !== "string" || !/^\d{5,25}$/.test(body.discordId)) {
    return jsonError(400, "BAD_TARGET", "付与先のDiscord IDが不正です。");
  }
  if (
    typeof body.amount !== "number" ||
    !Number.isInteger(body.amount) ||
    body.amount === 0 ||
    Math.abs(body.amount) > MAX_ABS_AMOUNT
  ) {
    return jsonError(400, "BAD_AMOUNT", "付与量は0以外の整数(±1,000,000以内)で指定してください。");
  }
  if (typeof body.reasonCode !== "string" || !REASON_PATTERN.test(body.reasonCode)) {
    return jsonError(400, "BAD_REASON", "理由コードはA-Z0-9_の3〜64文字で指定してください。");
  }
  if (
    typeof body.idempotencyKey !== "string" ||
    !/^[A-Za-z0-9._:-]{8,128}$/.test(body.idempotencyKey)
  ) {
    return jsonError(400, "BAD_IDEMPOTENCY_KEY", "冪等キーが不正です。");
  }
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") {
    return jsonError(400, "BAD_NOTE", "メモ形式が不正です。");
  }
  if (typeof body.note === "string" && body.note.length > 500) {
    return jsonError(400, "BAD_NOTE", "メモは500文字以内で指定してください。");
  }
  const normalizedNote = typeof body.note === "string" ? body.note.trim() : "";
  const note = normalizedNote || null;

  const target = await getPlayer(db, body.discordId);
  if (!target) {
    return jsonError(404, "PLAYER_NOT_FOUND", "対象プレイヤーはまだDiscord連携していません。");
  }

  const requestFingerprint = await grantRequestFingerprint({
    actor: session.sub,
    discordId: body.discordId,
    amount: body.amount,
    reasonCode: body.reasonCode,
    note,
  });

  let alreadyGranted = false;
  try {
    await appendPointGrantWithAudit(db, {
      discordId: body.discordId,
      amount: body.amount,
      reasonCode: body.reasonCode,
      note,
      grantedBy: session.sub,
      idempotencyKey: body.idempotencyKey,
      requestFingerprint,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const existing = await getGrantByIdempotencyKey(db, body.idempotencyKey);
    if (!existing) throw error;
    const legacyPayloadMatches =
      !existing.requestFingerprint &&
      existing.grantedBy === session.sub &&
      existing.discordId === body.discordId &&
      existing.amount === body.amount &&
      existing.reasonCode === body.reasonCode &&
      existing.note === note;
    if (existing.requestFingerprint !== requestFingerprint && !legacyPayloadMatches) {
      return jsonError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "同じ冪等キーが異なる付与内容ですでに使用されています。",
      );
    }
    alreadyGranted = true;
  }

  const balance = await getPointBalance(db, body.discordId);
  return Response.json(
    { ok: true, alreadyGranted, balance },
    { headers: { "Cache-Control": "no-store" } },
  );
}
