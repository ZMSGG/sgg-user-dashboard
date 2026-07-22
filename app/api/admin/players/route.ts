import { desc, sql } from "drizzle-orm";
import {
  adminDiscordIds,
  isHighAssuranceSession,
  jsonError,
  readSession,
} from "../../../../server/auth";
import { getDb } from "../../../../server/passport-db";
import { players, pointGrants } from "../../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = await getDb();
  const session = await readSession(request);
  if (!db || !session) return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");
  if (!isHighAssuranceSession(session)) {
    return jsonError(403, "HIGH_ASSURANCE_REQUIRED", "通常のDiscord認証が必要です。");
  }
  if (!(await adminDiscordIds()).has(session.sub)) {
    return jsonError(403, "NOT_ADMIN", "管理者権限がありません。");
  }

  const rows = await db
    .select({
      discordId: players.discordId,
      username: players.discordUsername,
      globalName: players.discordGlobalName,
      walletAddress: players.walletAddress,
      createdAt: players.createdAt,
      lastLoginAt: players.lastLoginAt,
      balance: sql<number>`COALESCE((SELECT SUM(${pointGrants.amount}) FROM ${pointGrants} WHERE ${pointGrants.discordId} = ${players.discordId}), 0)`,
    })
    .from(players)
    .orderBy(desc(players.lastLoginAt))
    .limit(200);

  const minimizedRows = rows.map(({ walletAddress, ...row }) => ({
    ...row,
    walletLabel: walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : null,
  }));

  return Response.json(
    { ok: true, players: minimizedRows },
    { headers: { "Cache-Control": "no-store" } },
  );
}
