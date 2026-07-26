import {
  adminDiscordIds,
  hasJsonRequestHeader,
  hasRecentAuthentication,
  jsonError,
  playerOsEnv,
  readSession,
} from "../../../../../server/auth";
import {
  confirmGameLink,
  listIssuedLinks,
  OTOMO_CHAIN_GAME_ID,
  planReconciliation,
} from "../../../../../server/game-link";
import {
  fetchOtomoChainExport,
  otomoChainExportConfigFromEnv,
} from "../../../../../server/otomo-chain-export";
import { getDb, isUniqueConstraintError } from "../../../../../server/passport-db";

export const dynamic = "force-dynamic";

/**
 * Binds OTOMO CHAIN 7 accounts to Player Passports by observing the link code
 * a player wrote into their game profile.
 *
 * Deliberately does NOT grant points. Reconciliation and payout are separate
 * steps so the operator can inspect the plan — including anything ambiguous —
 * before any ledger row exists. Defaults to a dry run.
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
      "安全のため、ログアウト後にDiscordへ再接続してから実行してください。",
    );
  }

  const env = await playerOsEnv();
  const config = otomoChainExportConfigFromEnv(env);
  if (!config) {
    return jsonError(
      503,
      "EXPORT_NOT_CONFIGURED",
      "OTOMO CHAINの照合連携は未設定です。エンドポイントと管理シークレットを設定してください。",
    );
  }

  let body: { apply?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return jsonError(400, "BAD_JSON", "リクエスト本文を読み取れません。");
  }
  const apply = body.apply === true;

  const exported = await fetchOtomoChainExport(config);
  if (!exported) {
    return jsonError(
      502,
      "EXPORT_UNAVAILABLE",
      "OTOMO CHAINの成績エクスポートを取得できませんでした。",
    );
  }

  const issued = await listIssuedLinks(db, OTOMO_CHAIN_GAME_ID);
  const plan = planReconciliation(
    issued.map((row) => ({ linkCode: row.linkCode, discordId: row.discordId })),
    exported.records.map((record) => ({
      gamePlayerId: record.playerId,
      externalId: record.externalId,
    })),
  );

  // Already-bound rows are skipped rather than rewritten: a confirmed link is
  // a historical fact, and re-running must not move it to another account.
  const alreadyBound = new Set(
    issued.filter((row) => row.gamePlayerId).map((row) => row.discordId),
  );
  const pending = plan.matched.filter((match) => !alreadyBound.has(match.discordId));

  const confirmed: string[] = [];
  const conflicts: { discordId: string; gamePlayerId: string }[] = [];

  if (apply) {
    for (const match of pending) {
      try {
        await confirmGameLink(db, {
          gameId: OTOMO_CHAIN_GAME_ID,
          discordId: match.discordId,
          gamePlayerId: match.gamePlayerId,
          seasonId: exported.seasonId,
        });
        confirmed.push(match.discordId);
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        // The game account is already bound to a different Passport.
        conflicts.push({ discordId: match.discordId, gamePlayerId: match.gamePlayerId });
      }
    }
  }

  return Response.json({
    ok: true,
    applied: apply,
    seasonId: exported.seasonId,
    generatedAt: exported.generatedAt,
    exportedRecords: exported.records.length,
    issuedCodes: issued.length,
    summary: {
      pending: pending.length,
      alreadyBound: plan.matched.length - pending.length,
      confirmed: confirmed.length,
      conflicts: conflicts.length,
      ambiguous: plan.ambiguous.length,
      unknownCodes: plan.unknownCodes.length,
      unlinkedGameAccounts: plan.unlinked,
    },
    // Surfaced so a human can resolve them; never auto-resolved.
    ambiguous: plan.ambiguous,
    conflicts,
  }, { headers: { "Cache-Control": "no-store" } });
}
