/**
 * Read-only client for the OTOMO CHAIN 7 admin reward export.
 *
 * The game is pull-only: it has no outbound webhook, and `external_id` — the
 * field carrying our link code — is exposed on this admin endpoint alone, not
 * on the public leaderboards. Every read here is a GET; this module never
 * writes to the game and never mutates a season.
 *
 * Fails closed: with no configured endpoint and secret, callers get null and
 * reconciliation is unavailable rather than silently empty.
 */

import type { PlayerOsEnv } from "./auth";

export type OtomoChainExportConfig = {
  endpoint: string;
  adminSecret: string;
};

export type OtomoChainRecord = {
  playerId: string;
  displayName: string;
  externalId: string | null;
  finalRank: number | null;
  seasonScore: number;
  suspiciousFlag: boolean;
  integrityStatus: string;
  rewardWeight: number;
};

export type OtomoChainExport = {
  generatedAt: string;
  seasonId: string;
  records: OtomoChainRecord[];
};

const REQUEST_TIMEOUT_MS = 8_000;
/** A season is capped at seven ranked runs per player per day; this bounds a hostile response. */
const MAX_RECORDS = 20_000;

function isStrongSecret(value: unknown): value is string {
  if (typeof value !== "string" || value !== value.trim()) return false;
  if (new TextEncoder().encode(value).byteLength < 16) return false;
  return new Set(value).size >= 8;
}

export function otomoChainExportConfigFromEnv(env: PlayerOsEnv): OtomoChainExportConfig | null {
  const endpoint = env.OTOMO_CHAIN_EXPORT_URL;
  if (typeof endpoint !== "string" || !isStrongSecret(env.OTOMO_CHAIN_ADMIN_SECRET)) return null;

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return null;
  }
  // The admin secret must never leave over plaintext HTTP.
  if (parsed.protocol !== "https:") return null;

  return { endpoint: parsed.toString(), adminSecret: env.OTOMO_CHAIN_ADMIN_SECRET };
}

function parseRecord(value: unknown): OtomoChainRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  if (typeof record.player_id !== "string" || record.player_id.length === 0) return null;
  if (typeof record.display_name !== "string") return null;
  if (typeof record.season_score !== "number" || !Number.isFinite(record.season_score)) return null;
  if (record.external_id !== null && typeof record.external_id !== "string") return null;
  if (record.final_rank !== null && typeof record.final_rank !== "number") return null;

  return {
    playerId: record.player_id,
    displayName: record.display_name.slice(0, 64),
    externalId: record.external_id,
    finalRank: typeof record.final_rank === "number" ? record.final_rank : null,
    seasonScore: record.season_score,
    suspiciousFlag: record.suspicious_flag === true,
    integrityStatus: typeof record.integrity_status === "string" ? record.integrity_status : "UNKNOWN",
    rewardWeight: typeof record.reward_weight === "number" ? record.reward_weight : 0,
  };
}

export function parseExportPayload(value: unknown): OtomoChainExport | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  if (typeof payload.season_id !== "string" || !Array.isArray(payload.records)) return null;
  if (payload.records.length > MAX_RECORDS) return null;

  const records: OtomoChainRecord[] = [];
  for (const entry of payload.records) {
    const record = parseRecord(entry);
    // One malformed row invalidates the export: a partial payout list is
    // worse than no payout list.
    if (!record) return null;
    records.push(record);
  }

  return {
    generatedAt: typeof payload.generated_at === "string" ? payload.generated_at : "",
    seasonId: payload.season_id,
    records,
  };
}

export async function fetchOtomoChainExport(
  config: OtomoChainExportConfig,
): Promise<OtomoChainExport | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(config.endpoint, {
      method: "GET",
      headers: { accept: "application/json", "x-admin-secret": config.adminSecret },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    return parseExportPayload(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
