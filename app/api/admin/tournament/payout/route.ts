import {
  adminDiscordIds,
  grantRequestFingerprint,
  hasJsonRequestHeader,
  hasRecentAuthentication,
  jsonError,
  playerOsEnv,
  readSession,
} from "../../../../../server/auth";
import { listIssuedLinks, OTOMO_CHAIN_GAME_ID } from "../../../../../server/game-link";
import {
  fetchOtomoChainExport,
  otomoChainExportConfigFromEnv,
} from "../../../../../server/otomo-chain-export";
import {
  appendPointGrantWithAudit,
  getDb,
  getGrantByIdempotencyKey,
  getPlayer,
  isUniqueConstraintError,
} from "../../../../../server/passport-db";

export const dynamic = "force-dynamic";

const REASON_CODE = "TOURNAMENT_RESULT";

export type AwardTier = { maxRank: number; amount: number };

/**
 * The award table is supplied per request by the operator and is never
 * defaulted. SGP amounts are an official reward decision; this code has no
 * authority to invent one, so an absent or malformed table fails the request.
 */
export function parseAwardTable(value: unknown): AwardTier[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 32) return null;

  const tiers: AwardTier[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const tier = entry as { maxRank?: unknown; amount?: unknown };
    if (!Number.isInteger(tier.maxRank) || (tier.maxRank as number) < 1) return null;
    if (
      !Number.isInteger(tier.amount) ||
      (tier.amount as number) <= 0 ||
      (tier.amount as number) > 1_000_000
    ) return null;
    tiers.push({ maxRank: tier.maxRank as number, amount: tier.amount as number });
  }

  tiers.sort((a, b) => a.maxRank - b.maxRank);
  // Ambiguous tiers would make the payout depend on ordering rather than rule.
  if (new Set(tiers.map((tier) => tier.maxRank)).size !== tiers.length) return null;
  return tiers;
}

function awardFor(finalRank: number | null, tiers: AwardTier[]): number | null {
  if (finalRank === null || finalRank < 1) return null;
  for (const tier of tiers) {
    if (finalRank <= tier.maxRank) return tier.amount;
  }
  return null;
}

/**
 * Grants SGP for a finished OTOMO CHAIN season to Passports whose game account
 * was already confirmed by the reconcile step.
 *
 * Defaults to a dry run. Three separate guards stand between a tournament and
 * the ledger: the link must be confirmed, the run must be integrity-VERIFIED
 * and not flagged suspicious, and the idempotency key is derived from the
 * season and player so a repeated apply cannot double-pay.
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
    return jsonError(503, "EXPORT_NOT_CONFIGURED", "OTOMO CHAINの照合連携は未設定です。");
  }

  let body: { apply?: unknown; awards?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return jsonError(400, "BAD_JSON", "リクエスト本文を読み取れません。");
  }
  const apply = body.apply === true;
  const awards = parseAwardTable(body.awards);
  if (!awards) {
    return jsonError(
      400,
      "AWARD_TABLE_REQUIRED",
      "SGP付与表(awards)を指定してください。順位ごとの付与量は運営の決定事項で、既定値はありません。",
    );
  }

  const exported = await fetchOtomoChainExport(config);
  if (!exported) {
    return jsonError(502, "EXPORT_UNAVAILABLE", "成績エクスポートを取得できませんでした。");
  }

  const confirmedLinks = (await listIssuedLinks(db, OTOMO_CHAIN_GAME_ID))
    .filter((row) => row.gamePlayerId);
  const gameAccountToDiscordId = new Map(
    confirmedLinks.map((row) => [row.gamePlayerId as string, row.discordId]),
  );

  const planned: { discordId: string; finalRank: number | null; amount: number }[] = [];
  const withheld: { gamePlayerId: string; reason: string }[] = [];

  for (const record of exported.records) {
    const discordId = gameAccountToDiscordId.get(record.playerId);
    if (!discordId) {
      withheld.push({ gamePlayerId: record.playerId, reason: "NO_CONFIRMED_LINK" });
      continue;
    }
    if (record.suspiciousFlag) {
      withheld.push({ gamePlayerId: record.playerId, reason: "SUSPICIOUS_FLAG" });
      continue;
    }
    if (record.integrityStatus !== "VERIFIED") {
      withheld.push({ gamePlayerId: record.playerId, reason: "NOT_VERIFIED" });
      continue;
    }
    const amount = awardFor(record.finalRank, awards);
    if (amount === null) {
      withheld.push({ gamePlayerId: record.playerId, reason: "NO_MATCHING_AWARD_TIER" });
      continue;
    }
    planned.push({ discordId, finalRank: record.finalRank, amount });
  }

  const granted: string[] = [];
  const alreadyGranted: string[] = [];
  const failed: { discordId: string; reason: string }[] = [];

  if (apply) {
    for (const entry of planned) {
      const idempotencyKey = `tournament:${exported.seasonId}:${entry.discordId}`;
      const note = `OTOMO CHAIN 7 ${exported.seasonId} rank ${entry.finalRank ?? "-"}`;

      if (!(await getPlayer(db, entry.discordId))) {
        failed.push({ discordId: entry.discordId, reason: "PLAYER_NOT_FOUND" });
        continue;
      }

      try {
        await appendPointGrantWithAudit(db, {
          discordId: entry.discordId,
          amount: entry.amount,
          reasonCode: REASON_CODE,
          note,
          grantedBy: session.sub,
          idempotencyKey,
          requestFingerprint: await grantRequestFingerprint({
            actor: session.sub,
            discordId: entry.discordId,
            amount: entry.amount,
            reasonCode: REASON_CODE,
            note,
          }),
        });
        granted.push(entry.discordId);
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        // A rerun after a partial failure lands here; the ledger already holds it.
        const existing = await getGrantByIdempotencyKey(db, idempotencyKey);
        if (existing) alreadyGranted.push(entry.discordId);
        else failed.push({ discordId: entry.discordId, reason: "LEDGER_CONFLICT" });
      }
    }
  }

  return Response.json({
    ok: true,
    applied: apply,
    seasonId: exported.seasonId,
    reasonCode: REASON_CODE,
    summary: {
      planned: planned.length,
      totalAmount: planned.reduce((sum, entry) => sum + entry.amount, 0),
      granted: granted.length,
      alreadyGranted: alreadyGranted.length,
      failed: failed.length,
      withheld: withheld.length,
    },
    planned,
    withheld,
    failed,
  }, { headers: { "Cache-Control": "no-store" } });
}
