import { NextResponse } from "next/server";
import { characterPairs } from "../../dashboard-data";
import type { Availability, LiveData, LiveRanking } from "../../live-contract";

export const dynamic = "force-dynamic";



type LiveSnapshot = Omit<LiveData, "servedFrom" | "cacheAgeSeconds">;

const CHAIN_SEASON_SOURCE = "https://otomochain.sevengodsgames.com/api/season";
// limit=100 because the default page stops at 50 and silently truncates a
// season that ran with more finishers than that.
const CHAIN_LEADERBOARD_SOURCE = "https://otomochain.sevengodsgames.com/api/leaderboard/season?limit=100";

function parseChainSeason(value: unknown): LiveData["chainSeason"] {
  if (!value || typeof value !== "object") return null;
  const season = (value as { season?: unknown }).season;
  if (!season || typeof season !== "object") return null;
  const s = season as { name?: unknown; start_at?: unknown; end_at?: unknown; status?: unknown };
  if (
    typeof s.name !== "string" ||
    typeof s.start_at !== "string" ||
    typeof s.end_at !== "string" ||
    (s.status !== "UPCOMING" && s.status !== "ACTIVE" && s.status !== "ENDED")
  ) return null;
  return { name: s.name.slice(0, 64), startAt: s.start_at, endAt: s.end_at, status: s.status };
}

type ChainEntry = {
  rank?: unknown;
  display_name?: unknown;
  season_score?: unknown;
  representative_god_id?: unknown;
};

/** The game returns god ids; the dashboard shows the canon Japanese names. */
const CHAIN_GOD_NAMES: Record<string, string> = Object.fromEntries(
  characterPairs.map((pair) => [pair.godId.toLowerCase(), pair.godName]),
);

function parseChainLeaderboard(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const payload = value as { entries?: unknown; total?: unknown };
  if (!Array.isArray(payload.entries)) return null;

  const valid = payload.entries.every((entry: ChainEntry) =>
    typeof entry.rank === "number" &&
    typeof entry.display_name === "string" &&
    typeof entry.season_score === "number"
  );
  if (!valid) return null;

  const entries: LiveRanking[] = payload.entries.slice(0, 7).map((entry: ChainEntry) => ({
    rank: entry.rank as number,
    name: (entry.display_name as string).slice(0, 48),
    score: entry.season_score as number,
    meta: typeof entry.representative_god_id === "string"
      ? CHAIN_GOD_NAMES[entry.representative_god_id.toLowerCase()] ?? ""
      : "",
  }));

  return {
    entries,
    participants: typeof payload.total === "number" ? payload.total : payload.entries.length,
  };
}


const RUNTIME_SOURCES = {
  chain: "https://otomochain.sevengodsgames.com/",
  farm: "https://otomofarm.sevengodsgames.com/",
  raid: "https://raid.sevengodsgames.com/",
  market: "https://oedomarket.sevengodsgames.com/",
} as const;

// Snapshot reuse protects upstream games from one fetch fan-out per visitor.
// Manual sync can bypass a normal snapshot, but a server-side cooldown prevents
// rapid sequential refreshes from becoming an amplification endpoint.
const SNAPSHOT_TTL_MS = 45_000;
const MANUAL_REFRESH_COOLDOWN_MS = 15_000;

let storedSnapshot: { snapshot: LiveSnapshot; storedAt: number } | null = null;
let inFlightRead: Promise<LiveSnapshot> | null = null;
let lastManualRefreshAt = 0;

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_500);

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function checkRuntime(url: string): Promise<Availability> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_500);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    const status = response.ok ? "online" : "unavailable";
    await response.body?.cancel().catch(() => undefined);
    return status;
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timeout);
  }
}



async function readUpstream(): Promise<LiveSnapshot> {
  const checkedAt = new Date().toISOString();
  const [rankingResults, runtimeEntries] = await Promise.all([
    Promise.allSettled([
      fetchJson(CHAIN_SEASON_SOURCE),
      fetchJson(CHAIN_LEADERBOARD_SOURCE),
    ]),
    Promise.all(
      Object.entries(RUNTIME_SOURCES).map(async ([key, url]) =>
        [key, await checkRuntime(url)] as const
      ),
    ),
  ]);

  const [chainSeasonResult, chainBoardResult] = rankingResults;
  const chainSeason = chainSeasonResult.status === "fulfilled"
    ? parseChainSeason(chainSeasonResult.value)
    : null;
  const chain = chainBoardResult.status === "fulfilled"
    ? parseChainLeaderboard(chainBoardResult.value)
    : null;
  const runtimes = Object.fromEntries(runtimeEntries) as Record<keyof typeof RUNTIME_SOURCES, Availability>;

  return {
    checkedAt,
    runtimes,
    runtimeOnlineCount: Object.values(runtimes).filter((state) => state === "online").length,
    runtimeTotal: Object.keys(RUNTIME_SOURCES).length,
    chainSeason,
    chain: chain ?? { entries: [], participants: 0 },
  };
}

function respond(payload: LiveData) {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request) {
  const manualRefreshRequested = new URL(request.url).searchParams.has("refresh");
  const now = Date.now();
  const manualRefreshCoolingDown = manualRefreshRequested &&
    lastManualRefreshAt > 0 &&
    now - lastManualRefreshAt < MANUAL_REFRESH_COOLDOWN_MS;

  if (
    storedSnapshot &&
    (manualRefreshCoolingDown || (!manualRefreshRequested && now - storedSnapshot.storedAt < SNAPSHOT_TTL_MS))
  ) {
    return respond({
      ...storedSnapshot.snapshot,
      servedFrom: "cache",
      cacheAgeSeconds: Math.max(0, Math.round((now - storedSnapshot.storedAt) / 1000)),
    });
  }

  if (manualRefreshRequested) lastManualRefreshAt = now;

  // Single-flight: concurrent visitors share one upstream fan-out instead
  // of multiplying requests against the public game endpoints.
  if (!inFlightRead) {
    inFlightRead = readUpstream().finally(() => {
      inFlightRead = null;
    });
  }
  const snapshot = await inFlightRead;
  storedSnapshot = { snapshot, storedAt: Date.now() };

  return respond({ ...snapshot, servedFrom: "origin", cacheAgeSeconds: 0 });
}
