import { NextResponse } from "next/server";
import type { Availability, LiveData, LiveRanking } from "../../live-contract";

export const dynamic = "force-dynamic";

type OracleEntry = {
  rank?: unknown;
  displayName?: unknown;
  score?: unknown;
  outcome?: unknown;
};

type QuestEntry = {
  rank?: unknown;
  username?: unknown;
  rankingPoints?: unknown;
  favoriteOtomo?: unknown;
};

type LiveSnapshot = Omit<LiveData, "servedFrom" | "cacheAgeSeconds">;

const RANKING_SOURCES = {
  oracle: "https://otomooracle.sevengodsgames.com/api/ranking?scope=daily",
  quest: "https://otomoquest.sevengodsgames.com/api/ranking",
} as const;

const RUNTIME_SOURCES = {
  oracle: "https://otomooracle.sevengodsgames.com/",
  quest: "https://otomoquest.sevengodsgames.com/",
  farm: "https://otomo-farm-77.vercel.app/",
  taiyo: "https://emberveil.sevengodsgames.com/",
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

function parseOracle(value: unknown): { day: number; entries: LiveRanking[] } | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as {
    ok?: unknown;
    scope?: unknown;
    day?: unknown;
    entries?: unknown;
  };
  if (
    payload.ok !== true ||
    payload.scope !== "daily" ||
    typeof payload.day !== "number" ||
    !Array.isArray(payload.entries)
  ) return null;

  const valid = payload.entries.every((entry: OracleEntry) =>
    typeof entry.rank === "number" &&
    typeof entry.displayName === "string" &&
    typeof entry.score === "number"
  );
  if (!valid) return null;

  const entries = payload.entries.slice(0, 7).map((entry: OracleEntry) => ({
    rank: entry.rank as number,
    name: (entry.displayName as string).slice(0, 48),
    score: entry.score as number,
    meta: entry.outcome === "completed"
      ? "COMPLETED"
      : entry.outcome === "timed_out"
        ? "TIMED OUT"
        : "OUTCOME UNKNOWN",
  }));

  return { day: payload.day, entries };
}

function parseQuest(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const payload = value as {
    season?: { name?: unknown; day?: unknown; totalDays?: unknown };
    ranking?: unknown;
  };
  if (
    !payload.season ||
    typeof payload.season.name !== "string" ||
    typeof payload.season.day !== "number" ||
    typeof payload.season.totalDays !== "number" ||
    !Array.isArray(payload.ranking)
  ) return null;

  const valid = payload.ranking.every((entry: QuestEntry) =>
    typeof entry.rank === "number" &&
    typeof entry.username === "string" &&
    typeof entry.rankingPoints === "number"
  );
  if (!valid) return null;

  const entries: LiveRanking[] = payload.ranking.slice(0, 7).map((entry: QuestEntry) => ({
    rank: entry.rank as number,
    name: (entry.username as string).slice(0, 48),
    score: entry.rankingPoints as number,
    meta: typeof entry.favoriteOtomo === "string"
      ? `OTOMO ${entry.favoriteOtomo.slice(0, 24)}`
      : "SEASON PLAYER",
  }));

  return {
    season: {
      name: payload.season.name,
      day: payload.season.day,
      totalDays: payload.season.totalDays,
    },
    entries,
    participants: payload.ranking.length,
  };
}

async function readUpstream(): Promise<LiveSnapshot> {
  const checkedAt = new Date().toISOString();
  const [rankingResults, runtimeEntries] = await Promise.all([
    Promise.allSettled([
      fetchJson(RANKING_SOURCES.oracle),
      fetchJson(RANKING_SOURCES.quest),
    ]),
    Promise.all(
      Object.entries(RUNTIME_SOURCES).map(async ([key, url]) =>
        [key, await checkRuntime(url)] as const
      ),
    ),
  ]);

  const [oracleResult, questResult] = rankingResults;
  const oracle = oracleResult.status === "fulfilled"
    ? parseOracle(oracleResult.value)
    : null;
  const quest = questResult.status === "fulfilled"
    ? parseQuest(questResult.value)
    : null;
  const runtimes = Object.fromEntries(runtimeEntries) as Record<keyof typeof RUNTIME_SOURCES, Availability>;

  return {
    checkedAt,
    runtimes,
    runtimeOnlineCount: Object.values(runtimes).filter((state) => state === "online").length,
    sources: {
      oracle: oracle ? "online" : "unavailable",
      quest: quest ? "online" : "unavailable",
    },
    oracle: oracle ?? { day: null, entries: [] },
    quest: quest ?? { season: null, entries: [], participants: 0 },
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
