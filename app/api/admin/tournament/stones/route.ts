import {
  adminDiscordIds,
  grantRequestFingerprint,
  hasJsonRequestHeader,
  hasRecentAuthentication,
  jsonError,
  playerOsEnv,
  readSession,
} from "../../../../../server/auth";
import {
  fetchOtomoChainPreEntries,
  otomoChainExportConfigFromEnv,
} from "../../../../../server/otomo-chain-export";
import {
  appendPointGrantWithAudit,
  getDb,
  getPlayer,
  isUniqueConstraintError,
} from "../../../../../server/passport-db";

export const dynamic = "force-dynamic";

/**
 * 勾玉配布: pre-entry名簿（ゲーム検証済みDiscord ID）に沿って MAGATAMA を
 * 一括付与する。金額は運営がリクエストで指定し、既定値は持たない。
 * dry-run 既定。冪等キーは stone:pre:<season>:<discord_id> なので再実行は安全:
 * まだダッシュボード未登録の参加者は withheld に出て、初回ログイン後の
 * 再実行で受け取れる。
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
    return jsonError(403, "RECENT_AUTH_REQUIRED", "再認証してから実行してください。");
  }

  const env = await playerOsEnv();
  const config = otomoChainExportConfigFromEnv(env);
  if (!config || !env.OTOMO_CHAIN_PREENTRY_URL) {
    return jsonError(503, "PREENTRY_NOT_CONFIGURED", "pre-entry連携は未設定です。");
  }

  let body: { apply?: unknown; amount?: unknown; seasonId?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return jsonError(400, "BAD_JSON", "リクエスト本文を読み取れません。");
  }
  const apply = body.apply === true;
  const amount = body.amount;
  if (!Number.isInteger(amount) || (amount as number) <= 0 || (amount as number) > 10_000) {
    return jsonError(400, "AMOUNT_REQUIRED", "配布量(amount)は運営の決定事項です。1〜10000の整数で明示してください。");
  }
  if (typeof body.seasonId !== "string" || !/^[A-Za-z0-9-]{4,64}$/.test(body.seasonId)) {
    return jsonError(400, "SEASON_REQUIRED", "冪等キーの単位となる seasonId を明示してください。");
  }

  const roster = await fetchOtomoChainPreEntries(config, env.OTOMO_CHAIN_PREENTRY_URL);
  if (!roster) return jsonError(502, "PREENTRY_UNAVAILABLE", "pre-entry名簿を取得できませんでした。");

  const planned: string[] = [];
  const withheld: { gamePlayerId: string; reason: string }[] = [];
  for (const entry of roster) {
    if (!entry.discordId) {
      withheld.push({ gamePlayerId: entry.playerId, reason: "NO_DISCORD_ID" });
      continue;
    }
    if (!(await getPlayer(db, entry.discordId))) {
      withheld.push({ gamePlayerId: entry.playerId, reason: "NOT_REGISTERED_YET" });
      continue;
    }
    planned.push(entry.discordId);
  }

  const granted: string[] = [];
  const alreadyGranted: string[] = [];
  if (apply) {
    for (const discordId of planned) {
      const idempotencyKey = `stone:pre:${body.seasonId}:${discordId}`;
      const note = `OTOMO CHAIN 7 ${body.seasonId} pre-entry`;
      try {
        await appendPointGrantWithAudit(db, {
          discordId,
          amount: amount as number,
          currency: "MAGATAMA",
          reasonCode: "EVENT_STONE",
          note,
          grantedBy: session.sub,
          idempotencyKey,
          requestFingerprint: await grantRequestFingerprint({
            actor: session.sub, discordId, amount: amount as number,
            reasonCode: "EVENT_STONE", note,
          }),
        });
        granted.push(discordId);
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        alreadyGranted.push(discordId);
      }
    }
  }

  return Response.json({
    ok: true,
    applied: apply,
    amount,
    summary: {
      roster: roster.length,
      planned: planned.length,
      granted: granted.length,
      alreadyGranted: alreadyGranted.length,
      withheld: withheld.length,
    },
    withheld,
  }, { headers: { "Cache-Control": "no-store" } });
}
