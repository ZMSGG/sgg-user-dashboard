import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Availability = "online" | "unavailable";

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

type PublicRanking = {
  rank: number;
  name: string;
  score: number;
  meta: string;
};

const RANKING_SOURCES = {
  oracle: "https://otomooracle.sevengodsgames.com/api/ranking?scope=daily",
  quest: "https://otomoquest.sevengodsgames.com/api/ranking",
} as const;

const RUNTIME_SOURCES = {
  oracle: "https://otomooracle.sevengodsgames.com/",
  quest: "https://otomoquest.sevengodsgames.com/",
  farm: "https://otomofarm.sevengodsgames.com/",
  taiyo: "https://emberveil.sevengodsgames.com/",
} as const;

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

function parseOracle(value: unknown): { day: number; entries: PublicRanking[] } | null {
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

  const entries: PublicRanking[] = payload.ranking.slice(0, 7).map((entry: QuestEntry) => ({
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

export async function GET() {
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

  return NextResponse.json(
    {
      checkedAt,
      runtimes,
      runtimeOnlineCount: Object.values(runtimes).filter((state) => state === "online").length,
      sources: {
        oracle: oracle ? "online" : "unavailable",
        quest: quest ? "online" : "unavailable",
      },
      oracle: oracle ?? { day: null, entries: [] },
      quest: quest ?? { season: null, entries: [], participants: 0 },
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
