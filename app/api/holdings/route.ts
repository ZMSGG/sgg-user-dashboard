import { jsonError, readSession } from "../../../server/auth";
import { readHoldings } from "../../../server/onchain-holdings";
import { getDb, getPlayer } from "../../../server/passport-db";

export const dynamic = "force-dynamic";

/**
 * On-chain holdings for the signed-in player's linked wallet.
 *
 * The address comes from the server-side player row, never from the request,
 * so a browser cannot ask for someone else's holdings. Read-only and
 * display-only: nothing here affects rank, SGP, or reward eligibility.
 */
export async function GET(request: Request) {
  const db = await getDb();
  const session = await readSession(request);
  if (!db || !session) return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");

  const player = await getPlayer(db, session.sub);
  if (!player) return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");

  if (!player.walletAddress) {
    // Not an error: playing without a wallet is fully supported.
    return Response.json(
      { linked: false, holdings: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const snapshot = await readHoldings(player.walletAddress);
  return Response.json(
    { linked: true, ...snapshot },
    { headers: { "Cache-Control": "no-store" } },
  );
}
