import {
  hasJsonRequestHeader,
  jsonError,
  playerOsEnv,
  readSession,
} from "../../../../server/auth";
import {
  fetchGuildMember,
  guildSyncConfigFromEnv,
  isGuildSyncCooldownActive,
} from "../../../../server/discord-guild";
import { getDb, getPlayer, updateGuildMembership } from "../../../../server/passport-db";

export const dynamic = "force-dynamic";

/**
 * Manual guild membership re-sync for the signed-in player. Membership is
 * fetched server-side with the bot token; failures keep the previous durable
 * snapshot instead of recording a fabricated state.
 */
export async function POST(request: Request) {
  if (!hasJsonRequestHeader(request)) {
    return jsonError(403, "BAD_REQUEST_HEADER", "不正なリクエストです。");
  }
  const env = await playerOsEnv();
  const config = guildSyncConfigFromEnv(env);
  const db = await getDb();
  const session = await readSession(request);
  if (!db || !session) return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");
  if (!config) {
    return jsonError(503, "GUILD_NOT_CONFIGURED", "コミュニティ参加確認は現在準備中です。");
  }

  const player = await getPlayer(db, session.sub);
  if (!player) return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");
  if (isGuildSyncCooldownActive(player.guildSyncedAt)) {
    return jsonError(429, "SYNC_COOLDOWN", "確認間隔が短すぎます。しばらく待って再試行してください。");
  }

  const snapshot = await fetchGuildMember(config, session.sub);
  if (!snapshot) {
    return jsonError(502, "GUILD_SYNC_FAILED", "Discordから参加状態を取得できませんでした。");
  }

  const syncedAt = new Date().toISOString();
  await updateGuildMembership(db, {
    discordId: session.sub,
    member: snapshot.member,
    joinedAt: snapshot.joinedAt,
    roles: snapshot.roles,
    syncedAt,
  });

  return Response.json(
    {
      ok: true,
      guild: {
        configured: true,
        member: snapshot.member,
        joinedAt: snapshot.joinedAt,
        roleCount: snapshot.roles.length,
        syncedAt,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
