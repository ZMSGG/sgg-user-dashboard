/**
 * Shared contract for the same-origin public read model (`/api/live`).
 * The route builds this shape after schema validation; the dashboard
 * consumes it as-is. Keeping one definition prevents silent drift
 * between server payload and client expectations.
 */

export type Availability = "online" | "unavailable";

export type LiveRanking = {
  rank: number;
  name: string;
  score: number;
  meta: string;
};

export type LiveData = {
  checkedAt: string;
  /** "origin" = fresh upstream reads, "cache" = server-side snapshot reuse. */
  servedFrom: "origin" | "cache";
  /** Seconds since the snapshot was read from upstream (0 for origin). */
  cacheAgeSeconds: number;
  sources: { oracle: Availability; quest: Availability };
  runtimes: {
    oracle: Availability;
    quest: Availability;
    farm: Availability;
    taiyo: Availability;
  };
  runtimeOnlineCount: number;
  oracle: { day: number | null; entries: LiveRanking[] };
  quest: {
    season: { name: string; day: number; totalDays: number } | null;
    entries: LiveRanking[];
    participants: number;
  };
};

export const emptyLiveData: LiveData = {
  checkedAt: "",
  servedFrom: "origin",
  cacheAgeSeconds: 0,
  sources: { oracle: "unavailable", quest: "unavailable" },
  runtimes: { oracle: "unavailable", quest: "unavailable", farm: "unavailable", taiyo: "unavailable" },
  runtimeOnlineCount: 0,
  oracle: { day: null, entries: [] },
  quest: { season: null, entries: [], participants: 0 },
};
