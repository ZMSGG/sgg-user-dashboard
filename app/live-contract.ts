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
  runtimes: {
    chain: Availability;
    farm: Availability;
    raid: Availability;
    market: Availability;
  };
  runtimeOnlineCount: number;
  /** How many runtimes were checked, so the UI never hardcodes the total. */
  runtimeTotal: number;
  /** OTOMO CHAIN season banner data, straight from the game's public API. */
  chainSeason: {
    name: string;
    startAt: string;
    endAt: string;
    status: "UPCOMING" | "ACTIVE" | "ENDED";
  } | null;
  /**
   * OTOMO CHAIN standings — the one competition the dashboard actually runs
   * tournaments for. Empty when the upstream did not answer; never rendered
   * as "nobody played".
   */
  chain: { entries: LiveRanking[]; participants: number };
};

export const emptyLiveData: LiveData = {
  checkedAt: "",
  servedFrom: "origin",
  cacheAgeSeconds: 0,
  runtimes: { chain: "unavailable", farm: "unavailable", raid: "unavailable", market: "unavailable" },
  runtimeOnlineCount: 0,
  runtimeTotal: 4,
  chainSeason: null,
  chain: { entries: [], participants: 0 },
};
