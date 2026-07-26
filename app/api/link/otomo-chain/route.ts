import { isStrongSessionSecret, jsonError, playerOsEnv, readSession } from "../../../../server/auth";
import { ensureGameLink, OTOMO_CHAIN_GAME_ID } from "../../../../server/game-link";
import { getDb, getPlayer } from "../../../../server/passport-db";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Issues (idempotently) the OTOMO CHAIN link code for the signed-in player.
 *
 * Read-only from the game's perspective: the dashboard never writes to OTOMO
 * CHAIN. The player carries the code across by hand, which is what makes the
 * game's unverified `external_id` field trustworthy to us.
 */
export async function GET(request: Request) {
  const env = await playerOsEnv();
  const db = await getDb();
  const session = await readSession(request);

  if (!db || !session || !isStrongSessionSecret(env.SESSION_SECRET)) {
    return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");
  }

  const player = await getPlayer(db, session.sub);
  if (!player) {
    return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");
  }

  const link = await ensureGameLink(db, {
    sessionSecret: env.SESSION_SECRET as string,
    gameId: OTOMO_CHAIN_GAME_ID,
    discordId: player.discordId,
  });

  return Response.json({
    gameId: link.gameId,
    linkCode: link.linkCode,
    issuedAt: link.issuedAt,
    // `verified` stays false until the code is observed on the game side.
    // Nothing here asserts a tournament result or a point grant.
    verified: Boolean(link.verifiedAt),
    verifiedAt: link.verifiedAt,
    verifiedSeasonId: link.verifiedSeasonId,
  }, { headers: NO_STORE });
}
