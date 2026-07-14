import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type OracleEntry = {
  rank?: number;
  displayName?: string;
  score?: number;
  outcome?: string;
};

type QuestEntry = {
  rank?: number;
  username?: string;
  rankingPoints?: number;
  favoriteOtomo?: string;
};

type PublicRanking = {
  rank: number;
  name: string;
  score: number;
  meta: string;
};

const SOURCES = {
  oracle: "https://otomooracle.sevengodsgames.com/api/ranking?scope=daily&day=1",
  quest: "https://otomoquest.sevengodsgames.com/api/ranking",
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

function sanitizeOracleEntries(value: unknown): PublicRanking[] {
  if (!value || typeof value !== "object") return [];
  const entries = (value as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return [];

  return entries.slice(0, 7).flatMap((entry: OracleEntry) => {
    if (
      typeof entry.rank !== "number" ||
      typeof entry.displayName !== "string" ||
      typeof entry.score !== "number"
    ) return [];
    return [{
      rank: entry.rank,
      name: entry.displayName.slice(0, 48),
      score: entry.score,
      meta: entry.outcome === "completed" ? "COMPLETED" : "TIMED OUT",
    }];
  });
}

function sanitizeQuest(value: unknown) {
  if (!value || typeof value !== "object") {
    return { season: null, entries: [] as PublicRanking[], participants: 0 };
  }
  const payload = value as {
    season?: { name?: unknown; day?: unknown; totalDays?: unknown };
    ranking?: unknown;
  };
  const ranking = Array.isArray(payload.ranking) ? payload.ranking : [];
  const entries = ranking.slice(0, 7).flatMap((entry: QuestEntry) => {
    if (
      typeof entry.rank !== "number" ||
      typeof entry.username !== "string" ||
      typeof entry.rankingPoints !== "number"
    ) return [];
    return [{
      rank: entry.rank,
      name: entry.username.slice(0, 48),
      score: entry.rankingPoints,
      meta: typeof entry.favoriteOtomo === "string"
        ? `OTOMO ${entry.favoriteOtomo.slice(0, 24)}`
        : "SEASON PLAYER",
    }];
  });
  const season = payload.season &&
    typeof payload.season.name === "string" &&
    typeof payload.season.day === "number" &&
    typeof payload.season.totalDays === "number"
      ? {
          name: payload.season.name.slice(0, 48),
          day: payload.season.day,
          totalDays: payload.season.totalDays,
        }
      : null;

  return { season, entries, participants: ranking.length };
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  const [oracleResult, questResult] = await Promise.allSettled([
    fetchJson(SOURCES.oracle),
    fetchJson(SOURCES.quest),
  ]);

  const oracle = oracleResult.status === "fulfilled"
    ? sanitizeOracleEntries(oracleResult.value)
    : [];
  const quest = questResult.status === "fulfilled"
    ? sanitizeQuest(questResult.value)
    : { season: null, entries: [] as PublicRanking[], participants: 0 };

  return NextResponse.json(
    {
      checkedAt,
      sources: {
        oracle: oracleResult.status === "fulfilled" ? "online" : "unavailable",
        quest: questResult.status === "fulfilled" ? "online" : "unavailable",
      },
      oracle: { entries: oracle },
      quest,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=90",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
