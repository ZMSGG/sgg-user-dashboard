import {
  adminDiscordIds,
  discordAuthConfigFromEnv,
  isHighAssuranceSession,
  playerOsEnv,
  readSession,
} from "../../../server/auth";
import { discordDmAuthConfigFromEnv } from "../../../server/discord-dm-auth";
import { guildSyncConfigFromEnv, parseGuildRoles } from "../../../server/discord-guild";
import { getDb, getPlayer, getPointBalance, getRecentGrants } from "../../../server/passport-db";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Read model for the signed-in player: identity, optional wallet, and the
 * SGG point ledger. Read-only — fetching a passport never mutates state.
 */
export async function GET(request: Request) {
  const env = await playerOsEnv();
  const db = await getDb();
  const authMethods = {
    oauth: Boolean(discordAuthConfigFromEnv(env) && db),
    dmOtp: Boolean(discordDmAuthConfigFromEnv(env) && db),
  };
  const configured = authMethods.oauth || authMethods.dmOtp;

  const session = await readSession(request);
  if (!session || !db) {
    return Response.json(
      { connected: false, authConfigured: configured, authMethods },
      { headers: NO_STORE },
    );
  }

  const player = await getPlayer(db, session.sub);
  if (!player) {
    return Response.json(
      { connected: false, authConfigured: configured, authMethods },
      { headers: NO_STORE },
    );
  }

  const [balance, grants] = await Promise.all([
    getPointBalance(db, player.discordId),
    getRecentGrants(db, player.discordId),
  ]);
  const adminAllowlisted = (await adminDiscordIds()).has(player.discordId);
  const highAssurance = isHighAssuranceSession(session);

  return Response.json(
    {
      connected: true,
      authConfigured: configured,
      authMethods,
      loginMethod: session.authMethod,
      player: {
        discordId: player.discordId,
        username: player.discordUsername,
        globalName: player.discordGlobalName,
        avatarUrl: player.discordAvatarHash
          ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatarHash}.png?size=64`
          : null,
        walletAddress: player.walletAddress,
        walletLinkedAt: player.walletLinkedAt,
      },
      guild: {
        configured: Boolean(guildSyncConfigFromEnv(env)),
        member: player.guildMember === null ? null : player.guildMember === 1,
        joinedAt: player.guildJoinedAt,
        roleCount: parseGuildRoles(player.guildRoles).length,
        syncedAt: player.guildSyncedAt,
      },
      points: { balance, grants },
      isAdmin: adminAllowlisted && highAssurance,
      adminUpgradeRequired: adminAllowlisted && !highAssurance,
    },
    { headers: NO_STORE },
  );
}
