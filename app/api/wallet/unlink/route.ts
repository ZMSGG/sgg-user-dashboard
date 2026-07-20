import { hasJsonRequestHeader, jsonError, readSession } from "../../../../server/auth";
import { getDb, getPlayer, unlinkWalletWithAudit } from "../../../../server/passport-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasJsonRequestHeader(request)) {
    return jsonError(403, "BAD_REQUEST_HEADER", "不正なリクエストです。");
  }
  const db = await getDb();
  const session = await readSession(request);
  if (!db || !session) {
    return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");
  }

  const player = await getPlayer(db, session.sub);
  if (!player) return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");
  if (!player.walletAddress) {
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }

  await unlinkWalletWithAudit(db, { session, previousAddress: player.walletAddress });

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
