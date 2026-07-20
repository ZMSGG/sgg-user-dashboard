import {
  adminDiscordIds,
  discordAuthConfigFromEnv,
  playerOsEnv,
  readSession,
} from "../../../server/auth";
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
  const configured = Boolean(discordAuthConfigFromEnv(env) && db);

  const session = await readSession(request);
  if (!session || !db) {
    return Response.json({ connected: false, authConfigured: configured }, { headers: NO_STORE });
  }

  const player = await getPlayer(db, session.sub);
  if (!player) {
    return Response.json({ connected: false, authConfigured: configured }, { headers: NO_STORE });
  }

  const [balance, grants] = await Promise.all([
    getPointBalance(db, player.discordId),
    getRecentGrants(db, player.discordId),
  ]);

  return Response.json(
    {
      connected: true,
      authConfigured: configured,
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
      points: { balance, grants },
      isAdmin: (await adminDiscordIds()).has(player.discordId),
    },
    { headers: NO_STORE },
  );
}
