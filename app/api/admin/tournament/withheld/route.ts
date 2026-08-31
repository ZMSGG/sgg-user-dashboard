import {
  adminDiscordIds,
  isHighAssuranceSession,
  jsonError,
  readSession,
} from "../../../../../server/auth";
import { getDb, getWithheldTournamentAwards } from "../../../../../server/passport-db";

export const dynamic = "force-dynamic";

/**
 * Tournament awards that were decided but never reached the ledger.
 *
 * Grants require a players row, so a finisher who has not yet opened MY SGG
 * is withheld until their first login. Nothing used to surface that: the
 * roster showed them as ordinary newcomers with a zero balance, and their own
 * card said 付与予定 indefinitely. This is the operator's view of exactly who
 * is still owed, and whether they have since registered — the ones with a
 * registeredAt can be paid by resending their rows now.
 *
 * Read-only, admin-only, and it grants nothing on its own: closing a withheld
 * award stays a deliberate, reviewed distribution.
 */
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

  const rows = await getWithheldTournamentAwards(db);
  const payable = rows.filter((row) => row.registeredAt !== null);

  return Response.json(
    {
      ok: true,
      withheld: rows.length,
      withheldSgp: rows.reduce((sum, row) => sum + row.sgpAmount, 0),
      /** Registered since the distribution: resending their rows pays them. */
      payableNow: payable.length,
      payableSgp: payable.reduce((sum, row) => sum + row.sgpAmount, 0),
      awards: rows.map((row) => ({
        tournamentId: row.tournamentId,
        seasonId: row.seasonId,
        discordId: row.discordId,
        rank: row.rank,
        sgpAmount: row.sgpAmount,
        idempotencyKey: row.idempotencyKey,
        registered: row.registeredAt !== null,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
