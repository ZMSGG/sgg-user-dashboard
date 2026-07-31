"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  characterPairs,
  communityItems,
  games,
  otomoForms,
  releaseStateCounts,
  releaseStateLabels,
  type Accent,
  type GameSummary,
  type ReleaseState,
} from "./dashboard-data";
import {
  IconArena,
  IconCommunity,
  IconGames,
  IconHome,
  IconLedger,
  IconOtomo,
  IconPassport,
  IconVault,
} from "./DockIcons";
import { emptyLiveData, type LiveData } from "./live-contract";
import type { AdminPlayerRow, PassportData } from "./passport-contract";
import { OtomoVignette } from "./OtomoSwarm";
import styles from "./Dashboard.module.css";

type View = "home" | "games" | "arena" | "collection" | "mysgg" | "community";
// 「すべて」は出さない — 休眠タイトルはプレイ可能の棚に混ぜず、休眠中タブに置く。
type GameFilter = Extract<ReleaseState, "LIVE" | "DORMANT">;
type FormFilter = "SPIRIT" | "INCARNATE" | "DOJI";
type SourceState = "online" | "unavailable" | "checking";
type LoadState = "idle" | "loading" | "ready" | "error";

type DiscordDmChallenge = {
  challengeId: string;
  expiresIn: number;
  expiresAt: number;
};

const DISCORD_DM_IDENTITY_PATTERN = /^(?:\d{5,25}|[a-z0-9._]{2,32})$/i;
const DISCORD_DM_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{10}$/;

type NavIcon = (props: { className?: string }) => React.ReactNode;

const navItems: readonly { id: View; label: string; eyebrow: string; Icon: NavIcon }[] = [
  { id: "home", label: "ホーム", eyebrow: "TODAY", Icon: IconHome },
  { id: "games", label: "プレイ", eyebrow: "PLAY", Icon: IconGames },
  { id: "arena", label: "アリーナ", eyebrow: "ARENA", Icon: IconArena },
  { id: "collection", label: "コレクション", eyebrow: "VAULT", Icon: IconVault },
  { id: "community", label: "コミュニティ", eyebrow: "FEED", Icon: IconCommunity },
  { id: "mysgg", label: "マイSGG", eyebrow: "PASSPORT", Icon: IconPassport },
] as const;

// Passive loads may reuse the server-side snapshot; forced syncs always
// re-read upstream. Auto re-sync keeps a visible tab close to this age.
const AUTO_SYNC_INTERVAL_MS = 90_000;

async function requestLiveData(force = false): Promise<LiveData> {
  const endpoint = force ? `/api/live?refresh=${Date.now()}` : "/api/live";
  const response = await fetch(endpoint, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json() as LiveData;
}

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

/** EIP-6963 announced wallet: Rabby, Phantom, MetaMask等が自己申告する。 */
type WalletProviderDetail = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: EthereumProvider;
};

/**
 * EIP-6963 multi-wallet discovery. Announcements arrive synchronously after
 * the request event in practice; the short timeout is only a safety margin.
 * Avoids the window.ethereum race where one extension impersonates another.
 */
function discoverWalletProviders(timeoutMs = 250): Promise<WalletProviderDetail[]> {
  return new Promise((resolve) => {
    const found: WalletProviderDetail[] = [];
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<WalletProviderDetail>).detail;
      if (
        detail?.info?.uuid &&
        typeof detail.provider?.request === "function" &&
        !found.some((entry) => entry.info.uuid === detail.info.uuid)
      ) {
        found.push(detail);
      }
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    window.setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      resolve(found);
    }, timeoutMs);
  });
}

async function postJson<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sgg-request": "1" },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await response.json().catch(() => null) as (T & { message?: string }) | null;
  if (!response.ok) {
    throw new Error(payload?.message ?? `HTTP ${response.status}`);
  }
  return payload as T;
}

async function requestPassport(): Promise<PassportData> {
  const response = await fetch("/api/passport", {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as PassportData | null;
  // 401 is the deliberate signed-out contract. Its body still carries the
  // available login methods so the public dashboard can render the correct
  // connect/setup state without treating sign-out as an outage.
  if (response.status === 401 && payload?.connected === false) return payload;
  if (!response.ok || !payload) throw new Error(`HTTP ${response.status}`);
  return payload;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Display-only wallet holdings. A null balance is unknown, never zero. */
type HoldingsData = {
  linked: boolean;
  chainId?: number;
  address?: string;
  readAt?: string;
  holdings: { id: string; label: string; kind: "NFT" | "TOKEN"; balance: string | null }[];
};

async function requestHoldings(): Promise<HoldingsData> {
  const response = await fetch("/api/holdings", {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json() as HoldingsData;
}

/** Unconnected and failed reads stay distinguishable from a real zero. */
function holdingValue(data: HoldingsData | null, id: string): string {
  if (!data?.linked) return "未接続";
  const holding = data.holdings.find((item) => item.id === id);
  return holding?.balance ?? "未取得";
}

/** OTOMO are three separate contracts; the chip shows the whole family. */
function otomoHoldingTotal(data: HoldingsData | null): string {
  if (!data?.linked) return "未接続";
  const otomo = data.holdings.filter((item) => item.id.startsWith("otomo-"));
  if (otomo.some((item) => item.balance === null)) return "未取得";
  return String(otomo.reduce((sum, item) => sum + Number(item.balance ?? 0), 0));
}

type OwnedTokenView = { tokenId: number; name: string | null; image: string | null; thumb: string | null };
type TokenPageView = { supported: boolean; total: number; tokens: OwnedTokenView[]; nextOffset: number | null };

async function requestOwnedTokens(collection: string, offset: number): Promise<TokenPageView> {
  const response = await fetch(`/api/holdings/tokens?collection=${encodeURIComponent(collection)}&offset=${offset}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json() as TokenPageView;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  not_configured: "Discord連携は現在準備中です",
  state_mismatch: "認証セッションが切れました。もう一度お試しください",
  discord_exchange_failed: "Discord認証に失敗しました。もう一度お試しください",
  persistence_failed: "認証情報を保存できませんでした。時間をおいて再度お試しください",
};

function formatGrantDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}

const views = new Set<View>(navItems.map((item) => item.id));
const number = new Intl.NumberFormat("ja-JP");
const runtimeKeyByGameId: Partial<Record<string, keyof LiveData["runtimes"]>> = {
  "otomo-oracle-7": "oracle",
  "otomo-quest-77": "quest",
  "otomo-farm-77": "farm",
  "taiyo-action-rpg": "taiyo",
  "otomo-chain-7": "chain",
};

/**
 * 本日の当番 — a deterministic 7-day rotation over the seven canonical pairs.
 * A presentation schedule owned by this dashboard, not a canon fact: it only
 * decides whose official art fronts the stage today.
 */
// All seven duty paintings shipped (batch-02 + batch-02R).
const DUTY_ROSTER = characterPairs;

function dutyPair(date = new Date()) {
  const dayOfYear = Math.floor(
    (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000,
  );
  return DUTY_ROSTER[dayOfYear % DUTY_ROSTER.length];
}

function viewFromHash(): View {
  if (typeof window === "undefined") return "home";
  const candidate = window.location.hash.slice(1) as View;
  return views.has(candidate) ? candidate : "home";
}

function formatSyncTime(value: string) {
  if (!value) return "未同期";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未同期";
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}


function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={styles.brand}>
      <span className={styles.brandMark} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/my-sgg-icon-v003.png" alt="" width={44} height={44} />
      </span>
      {!compact && (
        <span className={styles.brandText}>
          <strong>MY SGG</strong>
          <small>PLAYER OS</small>
        </span>
      )}
    </span>
  );
}

function Dot({ active = false }: { active?: boolean }) {
  return <span className={active ? styles.dotActive : styles.dot} aria-hidden="true" />;
}

function WalletIcon() {
  return (
    <svg
      className={styles.walletIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 7V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H4" />
      <circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function StatusPill({ children, accent = "cyan" }: { children: ReactNode; accent?: Accent }) {
  return <span className={styles.statusPill} data-tone={accent}>{children}</span>;
}

function SectionTitle({
  kicker,
  title,
  copy,
  action,
}: {
  kicker: string;
  title: string;
  copy?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.sectionTitle}>
      <div>
        <p>{kicker}</p>
        <h2>{title}</h2>
        {copy && <span>{copy}</span>}
      </div>
      {action}
    </div>
  );
}

function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {children}<span aria-hidden="true">↗</span>
    </a>
  );
}

/** Every title gets the same full-width card; no featured/library hierarchy. */
function GameCard({
  game,
  runtimeState,
  watched,
  onWatch,
}: {
  game: GameSummary;
  runtimeState: SourceState;
  watched: boolean;
  onWatch: (id: string) => void;
}) {
  return (
    <article className={styles.gameCard} data-tone={game.accent}>
      {game.releaseState === "MAINTENANCE" && (
        <div className={styles.constructionTape} aria-hidden="true">
          <span>⚠ UNDER CONSTRUCTION ⚠</span>
        </div>
      )}
      <div className={styles.gameCardTop}>
        <StatusPill accent={game.accent}>
          {game.releaseState === "LIVE" && <Dot active={runtimeState === "online"} />}
          {releaseStateLabels[game.releaseState]}
          {game.releaseState === "LIVE" && ` · ${runtimeState === "online" ? "ONLINE" : runtimeState === "checking" ? "CHECKING" : "稼働確認不可"}`}
        </StatusPill>
        <span>{game.duration === "ACTION" ? "ACTION" : `${game.duration} DAY`}</span>
      </div>
      {game.keyArt ? (
        <div className={styles.gameArt}>
          <Image src={game.keyArt} alt="" fill sizes="(max-width: 900px) 92vw, 30vw" />
        </div>
      ) : (
        // Dormant titles carry no key art, so the surface stays deliberately quiet.
        <div className={styles.gameGlyph} aria-hidden="true">{game.glyph}</div>
      )}
      <div className={styles.gameBody}>
        <p>{game.genre}</p>
        <h3>{game.title}</h3>
        <strong>{game.subtitle}</strong>
        <span>{game.description}</span>
      </div>
      <div className={styles.truthLine}>
        <small>{game.releaseLabel}</small>
        <span>{game.sourceLabel}</span>
      </div>
      <div className={styles.nextAction}>
        <span>NEXT</span>
        <div><strong>{game.nextAction}</strong><small>{game.nextActionMeta}</small></div>
      </div>
      <div className={styles.cardActions}>
        {game.releaseState === "MAINTENANCE" ? (
          // Under construction: the deployment exists but play links are
          // withheld until the rework is done.
          <button type="button" className={styles.primaryAction} disabled>工事中</button>
        ) : game.officialUrl ? (
          <ExternalLink href={game.officialUrl} className={styles.primaryAction}>
            {game.primaryAction}
          </ExternalLink>
        ) : (
          <button type="button" className={styles.primaryAction} onClick={() => onWatch(game.id)}>
            {watched ? "ウォッチ中" : game.primaryAction}<span aria-hidden="true">{watched ? "✓" : "+"}</span>
          </button>
        )}
        {game.releaseState !== "MAINTENANCE" && game.rankingUrl && <ExternalLink href={game.rankingUrl}>ランキング</ExternalLink>}
        {game.releaseState !== "MAINTENANCE" && game.guideUrl && <ExternalLink href={game.guideUrl}>ガイド</ExternalLink>}
      </div>
    </article>
  );
}

export function Dashboard() {
  const [activeView, setActiveView] = useState<View>("home");
  const [gameFilter, setGameFilter] = useState<GameFilter>("LIVE");
  const [formFilter, setFormFilter] = useState<FormFilter>("SPIRIT");
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [liveData, setLiveData] = useState<LiveData>(emptyLiveData);
  const [liveState, setLiveState] = useState<"loading" | "ready" | "error">("loading");
  const [passport, setPassport] = useState<PassportData | null>(null);
  const [passportState, setPassportState] = useState<Exclude<LoadState, "idle">>("loading");
  const [dmIdentity, setDmIdentity] = useState("");
  const [dmCode, setDmCode] = useState("");
  const [dmChallenge, setDmChallenge] = useState<DiscordDmChallenge | null>(null);
  const [dmAuthBusy, setDmAuthBusy] = useState(false);
  const [dmAuthMessage, setDmAuthMessage] = useState("");
  const [holdings, setHoldings] = useState<HoldingsData | null>(null);
  const [holdingsState, setHoldingsState] = useState<LoadState>("idle");
  const [nftViewer, setNftViewer] = useState<{ collection: string; label: string } | null>(null);
  const [nftTokens, setNftTokens] = useState<OwnedTokenView[]>([]);
  const [nftPage, setNftPage] = useState<{ total: number; nextOffset: number | null }>({ total: 0, nextOffset: null });
  const [nftState, setNftState] = useState<LoadState>("idle");
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletChoices, setWalletChoices] = useState<WalletProviderDetail[] | null>(null);
  const [guildBusy, setGuildBusy] = useState(false);
  const [adminPlayers, setAdminPlayers] = useState<AdminPlayerRow[] | null>(null);
  const [adminRosterState, setAdminRosterState] = useState<LoadState>("idle");
  const [grantForm, setGrantForm] = useState({ discordId: "", amount: "", reasonCode: "TESTER_FEEDBACK", note: "" });
  const [grantBusy, setGrantBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [stageGodId, setStageGodId] = useState<string | null>(null);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [grantHistoryOpen, setGrantHistoryOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const dmCodeInputRef = useRef<HTMLInputElement>(null);
  const dmIdentityInputRef = useRef<HTMLInputElement>(null);
  const checkedAtRef = useRef("");
  const adminRosterRequestRef = useRef(0);
  const grantAttemptRef = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);

  const activeNav = navItems.find((item) => item.id === activeView) ?? navItems[0];

  const persistSet = useCallback((key: string, next: Set<string>) => {
    try {
      window.localStorage.setItem(key, JSON.stringify([...next]));
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    for (const [key, setter] of [
      ["my-sgg-watched", setWatchedIds],
    ] as const) {
      try {
        const stored = window.localStorage.getItem(key);
        if (stored) setter(new Set(JSON.parse(stored) as string[]));
      } catch {
        // Device-local preferences are optional; malformed storage is ignored.
      }
    }
    // 推しGODS: 他の設定と同じく遅延させ、effect内の同期setStateを避ける。
    const stageGodTimeout = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("my-sgg-stage-god");
        if (stored && characterPairs.some((pair) => pair.godId === stored)) {
          setStageGodId(stored);
        }
      } catch {
        // Device-local preferences are optional; malformed storage is ignored.
      }
    }, 0);
    return () => window.clearTimeout(stageGodTimeout);
  }, []);

  const selectStageGod = useCallback((godId: string) => {
    setStageGodId(godId);
    setStagePickerOpen(false);
    try {
      window.localStorage.setItem("my-sgg-stage-god", godId);
    } catch {
      // Selection still applies for this session even if persistence fails.
    }
  }, []);

  const syncLiveData = useCallback(async (options?: { force?: boolean; announceFailure?: boolean }) => {
    try {
      const payload = await requestLiveData(options?.force ?? true);
      setLiveData(payload);
      setLiveState("ready");
    } catch {
      // Keep the last verified snapshot on screen; a failed re-sync must
      // not erase previously confirmed public data.
      setLiveState((current) => (current === "ready" ? "ready" : "error"));
      if (options?.announceFailure) {
        setToast(checkedAtRef.current
          ? "再同期に失敗しました。前回の同期結果を表示しています"
          : "公開データを取得できませんでした");
      }
    }
  }, []);

  useEffect(() => {
    checkedAtRef.current = liveData.checkedAt;
  }, [liveData.checkedAt]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void syncLiveData({ force: false }), 0);
    return () => window.clearTimeout(timeout);
  }, [syncLiveData]);

  // A visible tab re-syncs on a fixed cadence; a hidden tab stays quiet and
  // catches up as soon as it becomes visible again with a stale snapshot.
  useEffect(() => {
    const syncIfStale = () => {
      if (document.visibilityState !== "visible") return;
      const checkedAt = new Date(checkedAtRef.current).getTime();
      if (Number.isNaN(checkedAt) || Date.now() - checkedAt >= AUTO_SYNC_INTERVAL_MS) {
        void syncLiveData({ force: false });
      }
    };
    const interval = window.setInterval(syncIfStale, AUTO_SYNC_INTERVAL_MS);
    document.addEventListener("visibilitychange", syncIfStale);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", syncIfStale);
    };
  }, [syncLiveData]);

  const refreshPassport = useCallback(async (options?: { showLoading?: boolean }) => {
    if (options?.showLoading) setPassportState("loading");
    try {
      setPassport(await requestPassport());
      setPassportState("ready");
    } catch {
      // Preserve a previously verified Passport while clearly exposing that
      // the refresh itself failed. A network error is not "auth unconfigured".
      setPassportState("error");
    }
  }, []);

  /** Same-visit cache: reopening a collection reuses what was already fetched. */
  const nftCacheRef = useRef(new Map<string, { tokens: OwnedTokenView[]; total: number; nextOffset: number | null }>());

  const openNftViewer = useCallback(async (collection: string, label: string) => {
    setNftViewer({ collection, label });
    const hit = nftCacheRef.current.get(collection);
    if (hit) {
      setNftTokens(hit.tokens);
      setNftPage({ total: hit.total, nextOffset: hit.nextOffset });
      setNftState("ready");
      return;
    }
    setNftTokens([]);
    setNftPage({ total: 0, nextOffset: null });
    setNftState("loading");
    try {
      const page = await requestOwnedTokens(collection, 0);
      setNftTokens(page.tokens);
      setNftPage({ total: page.total, nextOffset: page.nextOffset });
      setNftState("ready");
      nftCacheRef.current.set(collection, { tokens: page.tokens, total: page.total, nextOffset: page.nextOffset });
    } catch {
      setNftState("error");
    }
  }, []);

  const loadMoreNftTokens = useCallback(async () => {
    if (!nftViewer || nftPage.nextOffset === null || nftState === "loading") return;
    setNftState("loading");
    try {
      const page = await requestOwnedTokens(nftViewer.collection, nftPage.nextOffset);
      setNftTokens((prev) => {
        const merged = [...prev, ...page.tokens];
        nftCacheRef.current.set(nftViewer.collection, { tokens: merged, total: page.total, nextOffset: page.nextOffset });
        return merged;
      });
      setNftPage({ total: page.total, nextOffset: page.nextOffset });
      setNftState("ready");
    } catch {
      setNftState("error");
    }
  }, [nftViewer, nftPage.nextOffset, nftState]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshPassport();
      const errorCookie = document.cookie.match(/(?:^|; )sgg_auth_error=([^;]+)/);
      if (errorCookie) {
        document.cookie = "sgg_auth_error=; Path=/; Max-Age=0";
        setToast(AUTH_ERROR_MESSAGES[errorCookie[1]] ?? "Discord認証に失敗しました");
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [refreshPassport]);

  // Holdings feed both the Vault and the top-bar chips, so they load once per
  // connected session rather than per view.
  useEffect(() => {
    const connected = Boolean(passport?.connected);
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!connected) return;
      setHoldingsState("loading");
      void (async () => {
        try {
          const data = await requestHoldings();
          if (cancelled) return;
          setHoldings(data);
          setHoldingsState("ready");
        } catch {
          if (!cancelled) setHoldingsState("error");
        }
      })();
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [passport?.connected]);

  useEffect(() => {
    if (!dmChallenge) return;
    dmCodeInputRef.current?.focus();
    const timeout = window.setTimeout(() => {
      setDmChallenge(null);
      setDmCode("");
      setDmAuthMessage("コードの有効期限が切れました。もう一度DMを受け取ってください。");
      window.setTimeout(() => dmIdentityInputRef.current?.focus(), 0);
    }, Math.max(0, dmChallenge.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [dmChallenge]);

  const isAdmin = passport?.connected === true && passport.isAdmin;

  const loadAdminPlayers = useCallback(async () => {
    const requestId = ++adminRosterRequestRef.current;
    setAdminRosterState("loading");
    try {
      const response = await fetch("/api/admin/players", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { players: AdminPlayerRow[] };
      if (requestId !== adminRosterRequestRef.current) return;
      setAdminPlayers(data.players);
      setAdminRosterState("ready");
    } catch {
      if (requestId !== adminRosterRequestRef.current) return;
      setAdminRosterState("error");
    }
  }, []);

  // Admin roster loads lazily, only on the passport view for admins.
  useEffect(() => {
    if (activeView !== "mysgg" || !isAdmin || adminRosterState !== "idle") return;
    const timeout = window.setTimeout(() => void loadAdminPlayers(), 0);
    return () => window.clearTimeout(timeout);
  }, [activeView, adminRosterState, isAdmin, loadAdminPlayers]);

  const logout = async () => {
    try {
      await postJson("/api/auth/logout");
      setPassport({
        connected: false,
        authConfigured: passport?.authConfigured ?? false,
        authMethods: passport?.authMethods,
      });
      setPassportState("ready");
      adminRosterRequestRef.current += 1;
      setAdminPlayers(null);
      setAdminRosterState("idle");
      setToast("ログアウトしました");
    } catch {
      setToast("ログアウトに失敗しました");
    }
  };

  const requestDiscordDmCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const identity = dmIdentity.trim().replace(/^@/, "");
    if (!DISCORD_DM_IDENTITY_PATTERN.test(identity)) {
      setDmAuthMessage("Discordユーザー名またはUser IDを確認してください。");
      return;
    }
    setDmAuthBusy(true);
    setDmAuthMessage("");
    try {
      const challenge = await postJson<Omit<DiscordDmChallenge, "expiresAt">>("/api/auth/discord/dm/start", { identity });
      setDmChallenge({
        ...challenge,
        expiresAt: Date.now() + challenge.expiresIn * 1_000,
      });
      setDmCode("");
      setDmAuthMessage("一致するSGGメンバーならDMを送信しました。コードは5分間・一度だけ有効です。SGGスタッフがコードを尋ねることはありません。");
    } catch (error) {
      setDmAuthMessage(error instanceof Error && error.message
        ? error.message
        : "DM認証を開始できませんでした。しばらく待って再試行してください。");
    } finally {
      setDmAuthBusy(false);
    }
  };

  const verifyDiscordDmCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dmChallenge) return;
    const code = dmCode.trim().toUpperCase().replaceAll("-", "").replaceAll(" ", "");
    if (!DISCORD_DM_CODE_PATTERN.test(code)) {
      setDmAuthMessage("DMに届いた10文字のコードを入力してください。");
      return;
    }
    setDmAuthBusy(true);
    setDmAuthMessage("");
    try {
      await postJson("/api/auth/discord/dm/verify", {
        challengeId: dmChallenge.challengeId,
        code,
      });
      setDmIdentity("");
      setDmCode("");
      setDmChallenge(null);
      setToast("Discord Player Passportへ接続しました");
      await refreshPassport({ showLoading: true });
    } catch (error) {
      setDmAuthMessage(error instanceof Error && error.message
        ? error.message
        : "コードを確認できませんでした。DMを確認して再試行してください。");
    } finally {
      setDmAuthBusy(false);
    }
  };

  const resetDiscordDmChallenge = () => {
    setDmChallenge(null);
    setDmCode("");
    setDmAuthMessage("");
    window.setTimeout(() => dmIdentityInputRef.current?.focus(), 0);
  };

  const linkWallet = async (chosen?: EthereumProvider) => {
    let provider = chosen ?? null;
    if (!provider) {
      const discovered = await discoverWalletProviders();
      if (discovered.length > 1) {
        // 複数ウォレット(Rabby、Phantom等)が居るときはユーザーに選ばせる。
        setWalletChoices(discovered);
        return;
      }
      provider = discovered[0]?.provider ??
        (window as { ethereum?: EthereumProvider }).ethereum ?? null;
    }
    if (!provider) {
      setToast("対応するWallet拡張が見つかりません(Rabby、Phantom、MetaMask等をインストールしてください)");
      return;
    }
    setWalletChoices(null);
    setWalletBusy(true);
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      const address = accounts?.[0];
      if (!address) throw new Error("Walletアカウントを取得できませんでした");
      const challenge = await postJson<{ message: string }>("/api/wallet/challenge", { address });
      const signature = await provider.request({
        method: "personal_sign",
        params: [challenge.message, address],
      }) as string;
      await postJson("/api/wallet/link", { address, signature });
      setToast("Walletを連携しました");
      await refreshPassport();
    } catch (error) {
      setToast(error instanceof Error && error.message ? error.message : "Wallet連携に失敗しました");
    } finally {
      setWalletBusy(false);
    }
  };

  const unlinkWallet = async () => {
    const linkedAddress = passport?.connected ? passport.player.walletAddress : null;
    if (!linkedAddress || !window.confirm(`${shortAddress(linkedAddress)} のWallet連携を解除しますか？\nポイント履歴とDiscord連携は維持されます。`)) {
      return;
    }
    setWalletBusy(true);
    try {
      await postJson("/api/wallet/unlink");
      setToast("Wallet連携を解除しました");
      await refreshPassport();
    } catch {
      setToast("Wallet連携の解除に失敗しました");
    } finally {
      setWalletBusy(false);
    }
  };

  const syncGuild = async () => {
    setGuildBusy(true);
    try {
      await postJson("/api/guild/sync");
      setToast("コミュニティ参加状態を更新しました");
      await refreshPassport();
    } catch (error) {
      setToast(error instanceof Error && error.message ? error.message : "参加状態を確認できませんでした");
    } finally {
      setGuildBusy(false);
    }
  };

  const submitGrant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(grantForm.amount);
    if (!Number.isInteger(amount) || amount === 0) {
      setToast("付与量は0以外の整数で入力してください");
      return;
    }
    const grantPayload = {
      discordId: grantForm.discordId.trim(),
      amount,
      reasonCode: grantForm.reasonCode.trim(),
      note: grantForm.note.trim() || undefined,
    };
    const fingerprint = JSON.stringify(grantPayload);
    if (!grantAttemptRef.current || grantAttemptRef.current.fingerprint !== fingerprint) {
      grantAttemptRef.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
    }
    setGrantBusy(true);
    try {
      const result = await postJson<{ alreadyGranted: boolean; balance: number }>("/api/admin/grants", {
        ...grantPayload,
        idempotencyKey: grantAttemptRef.current.idempotencyKey,
      });
      // The server confirmed this exact attempt, so the retry key can rotate.
      grantAttemptRef.current = null;
      setToast(result.alreadyGranted
        ? "同じ付与がすでに記録されています"
        : `付与を記録しました(新残高 ${number.format(result.balance)} SGP)`);
      setGrantForm((current) => ({ ...current, amount: "", note: "" }));
      setAdminPlayers(null);
      setAdminRosterState("idle");
      await refreshPassport();
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "付与に失敗しました";
      setToast(`${message}。同じ内容のまま安全に再試行できます`);
    } finally {
      setGrantBusy(false);
    }
  };

  useEffect(() => {
    const syncHash = () => setActiveView(viewFromHash());
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, []);

  useEffect(() => {
    document.title = `${activeNav.label} | MY SGG`;
  }, [activeNav.label]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const changeView = (view: View) => {
    setActiveView(view);
    if (window.location.hash !== `#${view}`) window.history.pushState(null, "", `#${view}`);
    window.requestAnimationFrame(() => mainRef.current?.focus());
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const toggleWatched = (id: string) => {
    const next = new Set(watchedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setWatchedIds(next);
    const saved = persistSet("my-sgg-watched", next);
    setToast(saved
      ? next.has(id) ? "ウォッチ設定をこの端末に保存しました" : "ウォッチ設定を解除しました"
      : "この端末ではウォッチ設定を保存できません");
  };

  // 工事中 titles stay on the front shelf next to the live ones — visible but
  // closed — rather than disappearing into 休眠中.
  const filteredGames = games.filter((game) => gameFilter === "LIVE"
    ? game.releaseState === "LIVE" || game.releaseState === "MAINTENANCE"
    : game.releaseState === gameFilter);
  const currentForm = otomoForms.find((form) => form.code === formFilter) ?? otomoForms[0];
  const getRuntimeState = (gameId: string): SourceState => {
    const runtimeKey = runtimeKeyByGameId[gameId];
    if (liveState === "loading") return "checking";
    if (liveState === "error" || !runtimeKey) return "unavailable";
    return liveData.runtimes[runtimeKey];
  };
  const runtimeSummary = liveState === "loading"
    ? "CHECKING"
    : liveState === "error"
      ? "HEALTH UNAVAILABLE"
      : `${liveData.runtimeOnlineCount} / 5 ONLINE`;
  const passportBridgeLabel = passportState === "loading" && !passport
    ? "PLAYER BRIDGE · CHECKING"
    : passportState === "error" && !passport
      ? "PLAYER BRIDGE · UNAVAILABLE"
      : passport?.connected
        ? "PLAYER BRIDGE · CONNECTED"
        : passport?.authConfigured === false
          ? "PLAYER BRIDGE · SETUP REQUIRED"
          : "PLAYER BRIDGE · NOT CONNECTED";
  const dmOtpAvailable = passport?.connected === false && passport.authMethods?.dmOtp === true;
  const oauthAvailable = passport?.authMethods?.oauth === true ||
    (passport?.connected === false && passport.authMethods === undefined && passport.authConfigured);
  const adminUpgradeRequired = passport?.connected === true &&
    passport.adminUpgradeRequired === true;
  const adminUpgradeAvailable = adminUpgradeRequired && oauthAvailable;

  return (
    <div className={styles.app}>
      <a href="#main-content" className={styles.skipLink}>メインコンテンツへ移動</a>

      <aside className={styles.sidebar} aria-label="メインナビゲーション">
        <Brand />
        <p className={styles.sidebarTagline}>ALL OF SGG.<br />ONE PLAYER OS.</p>
        <nav className={styles.sideNav}>
          {navItems.map((item, index) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={activeView === item.id ? styles.navActive : styles.navLink}
              aria-current={activeView === item.id ? "page" : undefined}
              onClick={(event) => { event.preventDefault(); changeView(item.id); }}
            >
              <span className={styles.navNumber}>{String(index + 1).padStart(2, "0")}</span>
              <span className={styles.navGlyph} aria-hidden="true"><item.Icon className={styles.navIcon} /></span>
              <span><small>{item.eyebrow}</small><strong>{item.label}</strong></span>
            </a>
          ))}
        </nav>
        {passport?.connected && (
          <button type="button" className={styles.passportCard} onClick={() => changeView("mysgg")}>
            <small>PLAYER PASSPORT</small>
            <div>
              {passport.player.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={passport.player.avatarUrl} alt="" width={38} height={38} />
                : <span className={styles.passportInitial} aria-hidden="true">{passport.player.username.slice(0, 1).toUpperCase()}</span>}
              <strong>{passport.player.globalName ?? passport.player.username}</strong>
            </div>
            <dl className={styles.passportStats}>
              <div><dt>SGP</dt><dd>{number.format(passport.points.balance)}</dd></div>
              <div><dt>SDT</dt><dd>{holdingValue(holdings, "sdt")}</dd></div>
              <div><dt>OTOMO</dt><dd>{otomoHoldingTotal(holdings)}</dd></div>
            </dl>
          </button>
        )}
        <section className={styles.sidebarStatus}>
          <span><Dot active={liveState === "ready" && liveData.runtimeOnlineCount === 5} />{runtimeSummary}</span>
          <small>PLAYER DATA BRIDGE · NOT CONNECTED</small>
        </section>
      </aside>

      <div className={styles.shell}>

        <main id="main-content" ref={mainRef} tabIndex={-1} className={styles.content}>
          <p className={styles.srOnly} aria-live="polite">{activeNav.label}を表示中</p>

          {activeView === "home" && (
            <div className={styles.homeLayout}>
              <div className={styles.homeMain}>
                <section className={styles.stage} aria-labelledby="hero-title">
                  <div className={styles.stageBackdrop}>
                    <Image src="/dashboard-art/bg-zipangu-dusk.png" alt="" fill priority sizes="(max-width: 900px) 100vw, 62vw" />
                  </div>
                  {(() => {
                    const duty = characterPairs.find((pair) => pair.godId === stageGodId) ?? dutyPair();
                    return (
                      <>
                        <div className={styles.stageActor} data-tone={duty.accent}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/dashboard-art/stage/duty-${duty.godId.toLowerCase()}.png`} alt={duty.godName} />
                        </div>
                        <div className={styles.stageOshi} data-tone={duty.accent}>
                          {stagePickerOpen && (
                            <div className={styles.stagePicker} role="listbox" aria-label="推しGODSを選ぶ">
                              {characterPairs.map((pair) => (
                                <button
                                  key={pair.godId}
                                  type="button"
                                  role="option"
                                  aria-selected={pair.godId === duty.godId}
                                  data-tone={pair.accent}
                                  onClick={() => selectStageGod(pair.godId)}
                                >
                                  <span>{pair.glyph}</span>{pair.godName}
                                </button>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            className={styles.stageDuty}
                            aria-expanded={stagePickerOpen}
                            onClick={() => setStagePickerOpen((open) => !open)}
                          >
                            <small>推しGODS</small>
                            <strong>{duty.godName}</strong>
                            <span>× {duty.otomoName}</span>
                          </button>
                        </div>
                      </>
                    );
                  })()}
                  <div className={styles.stageCopy}>
                    <p>SEVENGODS GAMES / PLAYER OS</p>
                    <h1 id="hero-title">遊ぶ。競う。集める。<br /><em>すべてを、ひとつに。</em></h1>
                  </div>
                  <nav className={styles.stageMenu} aria-label="クイックメニュー">
                    <button type="button" onClick={() => changeView("collection")}><IconOtomo className={styles.stageMenuSvg} />ガチャ</button>
                    <button type="button" onClick={() => changeView("collection")}><IconVault className={styles.stageMenuSvg} />図鑑</button>
                    <button type="button" onClick={() => changeView("arena")}><IconArena className={styles.stageMenuSvg} />闘技</button>
                    <button type="button" onClick={() => changeView("games")}><IconGames className={styles.stageMenuSvg} />出撃</button>
                    <button type="button" onClick={() => changeView("mysgg")}><IconPassport className={styles.stageMenuSvg} />連携</button>
                  </nav>
                  {liveData.chainSeason && (
                    <a
                      className={styles.eventBanner}
                      href="https://otomochain.sevengodsgames.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      data-status={liveData.chainSeason.status}
                    >
                      <small>{liveData.chainSeason.status === "ACTIVE" ? "開催中" : liveData.chainSeason.status === "UPCOMING" ? "開催予定" : "終了"}</small>
                      <strong>{liveData.chainSeason.name}</strong>
                      <span>{new Date(liveData.chainSeason.startAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" })}
                        {" 〜 "}
                        {new Date(liveData.chainSeason.endAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" })}</span>
                      <i aria-hidden="true">→</i>
                    </a>
                  )}
                  <OtomoVignette className={styles.swarmStage} items={[
                    { sprite: "taimaru", pose: "sit", left: "16%", bottom: "6px", size: 84 },
                    { sprite: "kotone", pose: "sleep", right: "14%", bottom: "4px", size: 72, flip: true },
                  ]} />
                  <div className={styles.heroSignal}>
                    <small>NETWORK</small><strong>{runtimeSummary}</strong><span>LIVE HEALTH · {formatSyncTime(liveData.checkedAt)}</span>
                  </div>
                </section>

                <section className={styles.featureRow} aria-label="主要導線">
                  <article data-tone="gold">
                    <div className={styles.featureArt}>
                      <Image src="/dashboard-art/cards/card-01.png" alt="" fill sizes="(max-width: 900px) 45vw, 15vw" style={{ objectPosition: "82% 46%" }} />
                    </div>
                    <small>PLAY NOW</small><h3>公開中のゲーム</h3>
                    <b>{releaseStateCounts.LIVE}</b><span>稼働中のruntime</span>
                    <button type="button" onClick={() => changeView("games")}>今すぐプレイ</button>
                  </article>
                  <article data-tone="violet">
                    <div className={styles.featureArt}>
                      <Image src="/dashboard-art/cards/card-02.png" alt="" fill sizes="(max-width: 900px) 45vw, 15vw" style={{ objectPosition: "62% 50%" }} />
                    </div>
                    <small>LIVE RANKING</small><h3>開催中の大会</h3>
                    <b>準備中</b><span>公開後にここへ表示されます</span>
                    <button type="button" onClick={() => changeView("arena")}>アリーナを見る</button>
                  </article>
                  <article data-tone="cyan">
                    <div className={styles.featureArt}>
                      <Image src="/dashboard-art/cards/card-03.png" alt="" fill sizes="(max-width: 900px) 45vw, 15vw" style={{ objectPosition: "72% 38%" }} />
                    </div>
                    <small>DIVINE COLLECTION</small><h3>神々コレクション</h3>
                    <b>{characterPairs.length}</b><span>GODS × OTOMO</span>
                    <button type="button" onClick={() => changeView("collection")}>コレクションへ</button>
                  </article>
                  <article data-tone="green">
                    <div className={styles.featureArt}>
                      <Image src="/dashboard-art/cards/card-04.png" alt="" fill sizes="(max-width: 900px) 45vw, 15vw" style={{ objectPosition: "62% 34%" }} />
                    </div>
                    <small>OTOMO GROWTH</small><h3>OTOMO育成</h3>
                    <b>未接続</b><span>ゲーム側ブリッジ待ち</span>
                    <button type="button" onClick={() => changeView("collection")}>接続状況を見る</button>
                  </article>
                  <article data-tone="coral">
                    <div className={styles.featureArt}>
                      <Image src="/dashboard-art/cards/card-05.png" alt="" fill sizes="(max-width: 900px) 45vw, 15vw" style={{ objectPosition: "70% 40%" }} />
                    </div>
                    <small>COMMUNITY SNS</small><h3>コミュニティSNS</h3>
                    <b>{communityItems.filter((item) => item.status === "PUBLISHED").length}</b><span>公開済みの更新</span>
                    <button type="button" onClick={() => changeView("community")}>もっと見る</button>
                  </article>
                </section>
              </div>
            </div>
          )}

          {activeView === "games" && (
            <div className={styles.viewStack}>
              <OtomoVignette className={styles.swarmGround} items={[{ sprite: "juka", pose: "sleep", right: "6%", bottom: "2px", size: 78 }, { sprite: "haku", pose: "sit", left: "4%", bottom: "0px", size: 66, flip: true }]} />
              <header className={styles.pageHeader}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.headerBand} src="/dashboard-art/headers/header-taiyo.png" alt="" aria-hidden="true" />
                <div><p>PLAY / GAME UNIVERSE</p><h1>SGGを遊ぶ</h1><span>公開状態、進行タイプ、公式URLを正本とlive healthから統合。</span></div>
                <div className={styles.pageStats}><span><b>{releaseStateCounts.LIVE}</b>PLAYABLE</span><span><b>{releaseStateCounts.DRAFT}</b>IN DEVELOPMENT</span><span><b>7·77·777</b>TIME AXES</span></div>
              </header>
              <div className={styles.filterBar} aria-label="ゲーム公開状態フィルター">
                {(["LIVE", "DORMANT"] as GameFilter[]).map((filter) => (
                  <button key={filter} type="button" aria-pressed={gameFilter === filter} className={gameFilter === filter ? styles.filterActive : ""} onClick={() => setGameFilter(filter)}>
                    {releaseStateLabels[filter]}
                  </button>
                ))}
              </div>
              <div className={styles.gameStack}>
                {filteredGames.map((game) => (
                  <GameCard key={game.id} game={game} runtimeState={getRuntimeState(game.id)} watched={watchedIds.has(game.id)} onWatch={toggleWatched} />
                ))}
              </div>
              <section className={styles.timeAxes}>
                <article><span>7</span><div><strong>熱狂</strong><p>短時間の挑戦・競争・更新</p></div></article>
                <article><span>77</span><div><strong>物語</strong><p>育成・待機・探索・シーズン</p></div></article>
                <article><span>777</span><div><strong>未来</strong><p>共同で積み重ねる長期構想</p></div></article>
              </section>
            </div>
          )}

          {activeView === "arena" && (
            <div className={styles.viewStack}>
              <OtomoVignette className={styles.swarmGround} items={[{ sprite: "momokatsu", pose: "cheer", right: "5%", bottom: "0px", size: 80 }]} />
              <header className={styles.pageHeader}>
                <div><p>ARENA / VERIFIED COMPETITION</p><h1>アリーナ</h1><span>大会と番付をここに集めます。</span></div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.headerBand} src="/dashboard-art/headers/header-sobi.png" alt="" aria-hidden="true" />
              </header>
              <section className={styles.eventEmpty}>
                <div><p>ARENA</p><h2>準備中</h2><span>大会の受付・締切・戦績と、ゲームごとの番付をここに表示します。中身を見せられる状態になるまで、この画面には何も出しません。</span></div>
              </section>
            </div>
          )}

          {activeView === "collection" && (
            <div className={styles.viewStack}>
              <OtomoVignette className={styles.swarmGround} items={[{ sprite: "shofuku", pose: "sit", right: "6%", bottom: "2px", size: 80 }, { sprite: "kozuchi", pose: "sleep", left: "5%", bottom: "0px", size: 64 }]} />
              <header className={styles.pageHeader}>
                <div><p>COLLECTION / SOURCE-AWARE VAULT</p><h1>コレクション</h1><span>オンチェーン保有、ゲーム内資産、公式キャラクター図鑑を混ぜずに統合。</span></div>
                <div className={styles.pageStats}><span><b>7</b>PAIRS</span><span><b>3</b>FORMS</span><span><b>未接続</b>MY ASSETS</span></div>
              </header>
              <section className={styles.holdingsSection}>
                <SectionTitle
                  kicker="ONCHAIN HOLDINGS / ETHEREUM MAINNET"
                  title="Wallet保有"
                  copy="連携済みWalletの保有数をチェーンから直接読み取ります。価格・評価額は表示せず、順位やSGPにも影響しません。"
                />
                {holdingsState === "loading" && <p className={styles.holdingsNote}>チェーンから読み取っています…</p>}
                {holdingsState === "error" && (
                  <p className={styles.holdingsNote}>保有情報を取得できませんでした。時間をおいて再度お試しください。</p>
                )}
                {holdingsState === "ready" && holdings && !holdings.linked && (
                  <p className={styles.holdingsNote}>
                    Walletが未連携です。マイSGGでWalletを連携すると保有数がここに表示されます。Walletが無くてもポイント付与に影響はありません。
                  </p>
                )}
                {holdingsState === "ready" && holdings?.linked && (
                  <>
                    <div className={styles.holdingsGrid}>
                      {holdings.holdings.map((item) => {
                        const enumerable = item.kind === "NFT" && Number(item.balance ?? 0) > 0;
                        return (
                          <article
                            key={item.id}
                            data-tone={item.kind === "TOKEN" ? "violet" : "gold"}
                            data-tappable={enumerable ? "true" : undefined}
                            role={enumerable ? "button" : undefined}
                            tabIndex={enumerable ? 0 : undefined}
                            onClick={enumerable ? () => void openNftViewer(item.id, item.label) : undefined}
                            onKeyDown={enumerable ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openNftViewer(item.id, item.label); } } : undefined}
                          >
                            <span>{item.kind}</span>
                            <h3>{item.label}</h3>
                            {/* A failed read must never render as 0. */}
                            <b>{item.balance ?? "未取得"}</b>
                            {enumerable && <small className={styles.holdingsTapHint}>タップで画像を見る</small>}
                          </article>
                        );
                      })}
                    </div>
                    <p className={styles.holdingsNote}>
                      {shortAddress(holdings.address ?? "")} の保有数。SDTはSEVENDAOのトークンで、SGGポイントとは別制度です。
                    </p>
                  </>
                )}
              </section>
              <section className={styles.gachaSection} data-tone="violet">
                <SectionTitle
                  kicker="GODS GACHA / GODSガチャ"
                  title="GコインでGODSガチャを引く"
                  copy="ダッシュボード限定のコレクションカード。NFTでもゲームアイテムでもなく、順位や報酬には影響しません。"
                />
                <div className={styles.gachaTeaser}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/dashboard-art/gacha/gacha-teaser.png" alt="OTOMOたちが金色の宝珠ガチャを覗き込むティザービジュアル" loading="lazy" />
                  <span className={styles.prepSeal}>準備中</span>
                </div>
                <p className={styles.holdingsNote}>GODSガチャは準備中です。Gコインの配布はイベント・大会と連動予定。公開までお待ちください。</p>
              </section>
              <section className={styles.gachaSection} data-tone="gold">
                <SectionTitle
                  kicker="OTOMO ZUKAN / OTOMO図鑑"
                  title="出会ったOTOMOを図鑑に記録"
                  copy="ガチャやイベントで出会ったOTOMOが自動で埋まっていくコレクション図鑑。"
                />
                <div className={styles.gachaTeaser}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/dashboard-art/gacha/zukan-teaser.png" alt="開いた図鑑の上で遊ぶOTOMOたちのティザービジュアル" loading="lazy" />
                  <span className={styles.prepSeal}>準備中</span>
                </div>
                <p className={styles.holdingsNote}>OTOMO図鑑は準備中です。GODSガチャと同時に公開予定。公開までお待ちください。</p>
              </section>
              <section>
                <SectionTitle
                  kicker="CANON CATALOG"
                  title="7 GODS × 7 OTOMO"
                  copy={`${currentForm.code} / ${currentForm.label} — ${currentForm.description}`}
                  action={<div className={styles.formTabs} aria-label="OTOMO形態">
                    {otomoForms.map((form) => <button key={form.code} type="button" aria-pressed={formFilter === form.code} className={formFilter === form.code ? styles.filterActive : ""} onClick={() => setFormFilter(form.code)}>{form.code}<small>{form.label}</small></button>)}
                  </div>}
                />
                <div className={styles.pairGrid}>
                  {characterPairs.map((pair, index) => (
                    <article key={pair.otomoId} data-tone={pair.accent}>
                      <span className={styles.pairNumber}>PAIR {String(index + 1).padStart(2, "0")}</span>
                      <div className={styles.pairArt}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/dashboard-art/pairs/pair-${pair.godId.toLowerCase()}-${formFilter.toLowerCase()}.png`} alt={`${pair.godName}と${pair.otomoName}（${currentForm.label}）の肖像`} loading="lazy" />
                      </div>
                      <div><small>{pair.godId}</small><h3>{pair.godName}</h3></div>
                      <i aria-hidden="true">×</i>
                      <div><small>{pair.otomoId}</small><h3>{pair.otomoName}</h3></div>
                      <StatusPill accent={pair.accent}>{formFilter} · {currentForm.label}</StatusPill>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeView === "mysgg" && (
            <div className={styles.viewStack}>
              <OtomoVignette className={styles.swarmGround} items={[{ sprite: "kozuchi", pose: "sleep", right: "7%", bottom: "2px", size: 70 }]} />
              <header className={styles.pageHeader}>
                <div><p>MY SGG / PLAYER PASSPORT</p><h1>マイSGG</h1><span>本人、履歴、ポイント、報酬、セキュリティを一つに。制度は混ぜません。</span></div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.headerBand} src="/dashboard-art/headers/header-fukuei.png" alt="" aria-hidden="true" />
                <StatusPill accent="coral">{passportBridgeLabel}</StatusPill>
              </header>
              <section className={styles.passportHero} aria-busy={passportState === "loading"}>
                <div className={styles.passportIdentity}>
                  {passport?.connected && passport.player.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.passportAvatar} src={passport.player.avatarUrl.replace("size=64", "size=128")} alt="" width={64} height={64} />
                  ) : (
                    <div className={styles.passportMark} aria-hidden="true">MY</div>
                  )}
                  <div>
                    <small>UNIFIED PLAYER ID</small>
                    <h2>{passportState === "loading" && !passport
                      ? "Player Passportを確認中"
                      : passportState === "error" && !passport
                        ? "Passportを読み込めません"
                        : passport?.connected
                          ? (passport.player.globalName ?? passport.player.username)
                          : "SGG Player Passport"}</h2>
                  </div>
                </div>
                <div>
                  <p>{passport?.connected
                    ? `ディスコード @${passport.player.username} として接続中。このディスコードでのゲームプレイにSGPが反映されます。`
                    : passportState === "loading"
                      ? "Discord連携状況とポイント台帳を安全に確認しています。"
                      : passportState === "error"
                        ? "ネットワークエラーのため連携状況を確認できません。ゲームと公開ランキングは引き続き利用できます。"
                        : passport?.authConfigured === false
                          ? "Discord認証は現在セットアップ中です。ゲームと公開ランキングは未接続のまま利用できます。"
                          : "正式identityはDiscord user ID。Walletは任意で、未接続でもゲームとraw rankingへ参加できます。"}</p>
                  <div className={styles.passportActions}>
                    {passportState === "loading" && !passport ? (
                      <button type="button" className={styles.primaryAction} disabled>Passportを確認中…</button>
                    ) : passportState === "error" && !passport ? (
                      <button type="button" className={styles.primaryAction} onClick={() => void refreshPassport({ showLoading: true })}>もう一度確認する</button>
                    ) : adminUpgradeAvailable ? (
                      <>
                        <a className={styles.primaryAction} href="/api/auth/discord">管理者としてDiscord再認証<span aria-hidden="true">→</span></a>
                        <button type="button" className={styles.textButton} onClick={() => void logout()}>ログアウト</button>
                      </>
                    ) : passport?.connected ? (
                      <button type="button" className={styles.textButton} onClick={() => void logout()}>ログアウト</button>
                    ) : oauthAvailable ? (
                      <a className={styles.primaryAction} href="/api/auth/discord">Discordで連携する<span aria-hidden="true">→</span></a>
                    ) : !dmOtpAvailable ? (
                      <button type="button" className={styles.primaryAction} disabled>Discord連携を準備中</button>
                    ) : null}
                  </div>
                  {passport?.connected && (
                    <div className={styles.heroWallet} data-tone="cyan">
                      {passport.player.walletAddress ? (
                        <>
                          <code className={styles.walletAddress}>{passport.player.walletAddress}</code>
                          <p>署名によるアドレス所有証明のみを記録しています。送金・トークン承認は行いません。</p>
                          <button type="button" className={styles.textButton} onClick={() => void unlinkWallet()} disabled={walletBusy}>
                            {walletBusy ? "処理中…" : "Wallet連携を解除"}
                          </button>
                        </>
                      ) : walletChoices ? (
                        <div className={styles.walletPicker} role="group" aria-label="使用するWalletを選択">
                          <p>使用するWalletを選択してください</p>
                          {walletChoices.map((choice) => (
                            <button
                              key={choice.info.uuid}
                              type="button"
                              onClick={() => void linkWallet(choice.provider)}
                              disabled={walletBusy}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={choice.info.icon} alt="" width={18} height={18} />
                              {choice.info.name}
                            </button>
                          ))}
                          <button type="button" className={styles.textButton} onClick={() => setWalletChoices(null)}>
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <>
                          <button type="button" className={styles.primaryAction} onClick={() => void linkWallet()} disabled={walletBusy}>
                            <WalletIcon />{walletBusy ? "署名を待っています…" : "Walletを連携する"}
                          </button>
                          <p>任意です。EVM系Wallet(Rabby、Phantom、MetaMask等)の署名でアドレス所有を証明します。無くてもポイント付与に影響はありません。</p>
                        </>
                      )}
                    </div>
                  )}
                  {adminUpgradeRequired && (
                    <p className={styles.dmAuthHelp}>DM認証はPlayer Passport専用です。管理機能には通常のDiscord認証が必要です。{oauthAvailable ? "上のボタンから再認証してください。" : "OAuthの準備が整うまで管理機能は利用できません。"}</p>
                  )}
                  {dmOtpAvailable && (
                    <div className={styles.dmAuthPanel}>
                      <strong className={styles.dmAuthTitle}>{oauthAvailable ? "OAuthが使えない場合 / BOT DM" : "BOT DMで本人確認"}</strong>
                      {dmChallenge ? (
                        <form className={styles.dmAuthForm} onSubmit={verifyDiscordDmCode}>
                          <label htmlFor="discord-dm-code">DMに届いた10文字コード</label>
                          <div>
                            <input
                              ref={dmCodeInputRef}
                              id="discord-dm-code"
                              value={dmCode}
                              onChange={(event) => setDmCode(event.target.value.toUpperCase())}
                              placeholder="ABCDE-FGHJK"
                              autoComplete="one-time-code"
                              inputMode="text"
                              maxLength={11}
                              spellCheck={false}
                              autoCapitalize="characters"
                              required
                            />
                            <button type="submit" className={styles.primaryAction} disabled={dmAuthBusy}>
                              {dmAuthBusy ? "確認中…" : "Passportへ接続"}
                            </button>
                          </div>
                          <button type="button" className={styles.textButton} onClick={resetDiscordDmChallenge} disabled={dmAuthBusy}>
                            ユーザー名を入力し直す
                          </button>
                        </form>
                      ) : (
                        <form className={styles.dmAuthForm} onSubmit={requestDiscordDmCode}>
                          <label htmlFor="discord-dm-identity">Discordユーザー名（@不要）またはUser ID</label>
                          <div>
                            <input
                              ref={dmIdentityInputRef}
                              id="discord-dm-identity"
                              value={dmIdentity}
                              onChange={(event) => setDmIdentity(event.target.value)}
                              placeholder="yourname"
                              autoComplete="username"
                              maxLength={32}
                              spellCheck={false}
                              required
                            />
                            <button type="submit" className={styles.primaryAction} disabled={dmAuthBusy}>
                              {dmAuthBusy ? "送信中…" : "DMコードを受け取る"}
                            </button>
                          </div>
                        </form>
                      )}
                      <p className={styles.dmAuthHelp} role="status" aria-live="polite">
                        {dmAuthMessage || (dmChallenge
                          ? `コードは${Math.ceil(dmChallenge.expiresIn / 60)}分間・一度だけ有効です。SGGスタッフがコードを尋ねることはありません。`
                          : "SGG Discord参加メンバーへ、MY SGG Botが本人確認コードをDMします。")}
                      </p>
                    </div>
                  )}
                </div>
                <div className={styles.passportStatus}>
                  <span><Dot active={passport?.connected === true} />Discord<strong>{passportState === "loading" && !passport ? "確認中" : passportState === "error" && !passport ? "取得不可" : passport?.connected ? "接続済み" : dmOtpAvailable ? "DM認証可能" : passport?.authConfigured === false ? "準備中" : "未接続"}</strong></span>
                  <span><Dot active={passport?.connected === true && Boolean(passport.player.walletAddress)} />Wallet<strong>{passportState === "loading" && !passport ? "確認中" : passport?.connected && passport.player.walletAddress ? shortAddress(passport.player.walletAddress) : "任意"}</strong></span>
                  <span><Dot active={passport?.connected === true && passport.guild.member === true} />コミュニティ<strong>{passportState === "loading" && !passport
                    ? "確認中"
                    : passport?.connected
                      ? (!passport.guild.configured
                        ? "準備中"
                        : passport.guild.member === true
                          ? "参加済み"
                          : passport.guild.member === false
                            ? "未参加"
                            : "未確認")
                      : passport?.authConfigured === false
                        ? "準備中"
                        : "Discord連携後"}</strong></span>
                  <span><Dot />Passkey<strong>準備中</strong></span>
                </div>
              </section>
              {passportState === "error" && (
                <div className={styles.resilienceNotice} role="alert">
                  <div>
                    <strong>Passport情報を取得できませんでした</strong>
                    <p>{passport
                      ? "前回確認できたPassportを表示しています。最新状態を確認するには再試行してください。"
                      : "接続状態を未接続や準備中と決めつけず、確認できない状態として表示しています。"}</p>
                  </div>
                  <button type="button" className={styles.textButton} onClick={() => void refreshPassport({ showLoading: true })}>再試行</button>
                </div>
              )}
              {passport?.connected && (
                <div className={styles.passportGrid}>
                  <section className={styles.pointsCard} data-tone="gold">
                    <div className={styles.pointsHead}>
                      <div><p>SGG POINT</p><h3>SGP残高</h3></div>
                      <StatusPill accent="gold">PASSPORT LEDGER</StatusPill>
                    </div>
                    <strong className={styles.pointsBalance}>{number.format(passport.points.balance)}<small>SGP</small></strong>
                    {passport.points.grants.length ? (
                      <>
                        <button
                          type="button"
                          className={styles.historyToggle}
                          aria-expanded={grantHistoryOpen}
                          onClick={() => setGrantHistoryOpen((open) => !open)}
                        >
                          履歴<i aria-hidden="true">{grantHistoryOpen ? "▲" : "▼"}</i>
                        </button>
                        {grantHistoryOpen && (
                          <ul className={styles.grantList}>
                            {passport.points.grants.map((grant, index) => (
                              <li key={`${grant.createdAt}-${index}`}>
                                <div>
                                  <strong>{grant.reasonCode}</strong>
                                  {grant.note && <small>{grant.note}</small>}
                                  <small>{formatGrantDate(grant.createdAt)}</small>
                                </div>
                                <b data-negative={grant.amount < 0 || undefined}>
                                  {grant.amount > 0 ? "+" : ""}{number.format(grant.amount)}
                                </b>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <p className={styles.grantEmpty}>まだ付与履歴はありません。テスター報奨が付与されるとここに記録されます。</p>
                    )}
                  </section>
                  <section className={styles.guildCard} data-tone="violet">
                    <div className={styles.pointsHead}>
                      <div><p>COMMUNITY</p><h3>Discordサーバー</h3></div>
                      <StatusPill accent="violet">{!passport.guild.configured
                        ? "SETUP REQUIRED"
                        : passport.guild.member === true
                          ? "JOINED"
                          : passport.guild.member === false
                            ? "NOT JOINED"
                            : "UNVERIFIED"}</StatusPill>
                    </div>
                    {!passport.guild.configured ? (
                      <p>コミュニティ参加確認は現在準備中です。Bot設定の完了後、SGG Discordサーバーの参加状態がここに表示されます。</p>
                    ) : passport.guild.member === true ? (
                      <p>
                        SGG Discordサーバーに参加済みです（ロール {number.format(passport.guild.roleCount)} 件）。
                        {passport.guild.syncedAt ? ` 最終確認 ${formatGrantDate(passport.guild.syncedAt)}。` : ""}
                        参加状態はキャンペーン参加条件の判定に使われます。
                      </p>
                    ) : passport.guild.member === false ? (
                      <p>SGG Discordサーバーへの参加が確認できませんでした。サーバー参加後に再確認してください。</p>
                    ) : (
                      <p>参加状態はまだ確認されていません。再確認を実行すると最新の参加状態を取得します。</p>
                    )}
                    {passport.guild.configured && (
                      <button type="button" className={styles.textButton} onClick={() => void syncGuild()} disabled={guildBusy}>
                        {guildBusy ? "確認中…" : "参加状態を再確認"}
                      </button>
                    )}
                  </section>
                </div>
              )}
              <section>
                <SectionTitle kicker="TRUSTED LEDGER" title="SGGでの軌跡" copy="これまでのランキングや称号がある場所。" />
                <p className={styles.grantEmpty}>まだ確定したランキング・称号はありません。大会の結果が確定するとここに記録されます。</p>
              </section>
              {isAdmin && (
                <section className={styles.adminPanel} data-tone="coral">
                  <SectionTitle kicker="ADMIN / POINT OPERATIONS" title="ポイント付与(管理者)" copy="付与はappend-onlyの台帳と監査recordに記録されます。取り消しはマイナス付与で行います。" />
                  <form className={styles.grantForm} onSubmit={submitGrant}>
                    <label>
                      <span>付与先 Discord ID</span>
                      <input
                        required
                        value={grantForm.discordId}
                        onChange={(event) => setGrantForm((current) => ({ ...current, discordId: event.target.value }))}
                        placeholder="000000000000000000"
                        pattern="\d{5,25}"
                      />
                    </label>
                    <label>
                      <span>付与量(整数・負数可)</span>
                      <input
                        required
                        value={grantForm.amount}
                        onChange={(event) => setGrantForm((current) => ({ ...current, amount: event.target.value }))}
                        placeholder="100"
                        inputMode="numeric"
                        pattern="-?\d+"
                      />
                    </label>
                    <label>
                      <span>理由コード</span>
                      <input
                        required
                        value={grantForm.reasonCode}
                        onChange={(event) => setGrantForm((current) => ({ ...current, reasonCode: event.target.value.toUpperCase() }))}
                        placeholder="TESTER_FEEDBACK"
                        pattern="[A-Z0-9_]{3,64}"
                      />
                    </label>
                    <label className={styles.grantNote}>
                      <span>メモ(任意)</span>
                      <input
                        value={grantForm.note}
                        onChange={(event) => setGrantForm((current) => ({ ...current, note: event.target.value }))}
                        placeholder="2026.07 プレビューテスト参加"
                      />
                    </label>
                    <button type="submit" className={styles.primaryAction} disabled={grantBusy}>
                      {grantBusy ? "記録中…" : "ポイントを付与"}
                    </button>
                  </form>
                  <div className={styles.adminRoster} aria-busy={adminRosterState === "loading"}>
                    <p>REGISTERED PLAYERS / {adminRosterState === "ready" ? (adminPlayers?.length ?? 0) : adminRosterState === "error" ? "取得不可" : "…"}</p>
                    {adminRosterState === "idle" || adminRosterState === "loading" ? (
                      <span className={styles.grantEmpty} role="status">プレイヤー一覧を読み込み中…</span>
                    ) : adminRosterState === "error" ? (
                      <div className={styles.inlineRetry} role="alert">
                        <span>プレイヤー一覧を取得できませんでした。空の一覧としては扱っていません。</span>
                        <button type="button" className={styles.textButton} onClick={() => void loadAdminPlayers()}>再試行</button>
                      </div>
                    ) : !adminPlayers?.length ? (
                      <span className={styles.grantEmpty}>まだDiscord連携したプレイヤーがいません。</span>
                    ) : (
                      <ul>
                        {adminPlayers.map((row) => (
                          <li key={row.discordId}>
                            <div>
                              <strong>{row.globalName ?? row.username}</strong>
                              <small>@{row.username} · {row.discordId}</small>
                              <small>{row.walletLabel ? `Wallet ${row.walletLabel}` : "Wallet未連携"}</small>
                            </div>
                            <div className={styles.adminRosterRight}>
                              <b>{number.format(row.balance)} SGP</b>
                              <button type="button" className={styles.textButton} onClick={() => setGrantForm((current) => ({ ...current, discordId: row.discordId }))}>
                                付与先にセット
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}

          {activeView === "community" && (
            <div className={styles.viewStack}>
              <OtomoVignette className={styles.swarmGround} items={[{ sprite: "haku", pose: "cheer", left: "5%", bottom: "0px", size: 74 }]} />
              <header className={styles.pageHeader}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.headerBand} src="/dashboard-art/headers/header-shouren.png" alt="" aria-hidden="true" />
                <div><p>COMMUNITY / OFFICIAL SIGNALS</p><h1>コミュニティSNS</h1><span>SGGの公式アカウントと外部アプリへの導線です。</span></div>
              </header>
              <aside className={styles.followPanel}>
                <p>COMMUNITY SNS</p><h2>公式チャンネル</h2><span>SGGの公式SNS・外部アプリへの導線です。</span>
                <div className={styles.snsList}>
                  <a href="https://sevengodsgames.com/" target="_blank" rel="noopener noreferrer"><span>SGG LP</span><small>sevengodsgames.com ↗</small></a>
                  <a href="https://seven-gods.com/" target="_blank" rel="noopener noreferrer"><span>SG LP</span><small>seven-gods.com ↗</small></a>
                  <a href="https://x.com/SEVENGODSGAMES" target="_blank" rel="noopener noreferrer"><span>X</span><small>@SEVENGODSGAMES ↗</small></a>
                  <a href="https://discord.gg/3ByquYMHUp" target="_blank" rel="noopener noreferrer"><span>ディスコード</span><small>招待リンク ↗</small></a>
                  <a aria-disabled="true"><span>SEVENDAOapp</span><small>準備中</small></a>
                </div>
              </aside>
              {/* 公式マーケット — the collections' own OpenSea pages and the SDT
                  DEX. Labels follow each collection's actual contents, which the
                  slugs match (SEIREITAI / JUNIKUTAI / DOUJI). */}
              <aside className={styles.followPanel}>
                <p>OFFICIAL MARKET</p><h2>公式マーケット</h2><span>SEVENGODSとOTOMOの公式コレクション、SDTの取引先です。</span>
                <div className={styles.snsList}>
                  <a href="https://opensea.io/ja/collection/seven-gods?activityTypes=sale" target="_blank" rel="noopener noreferrer"><span>SEVENGODS</span><small>OpenSea ↗</small></a>
                  <a href="https://opensea.io/ja/collection/otomo-douji" target="_blank" rel="noopener noreferrer"><span>OTOMO 童子</span><small>OpenSea ↗</small></a>
                  <a href="https://opensea.io/ja/collection/otomo-junikutai" target="_blank" rel="noopener noreferrer"><span>OTOMO 受肉体</span><small>OpenSea ↗</small></a>
                  <a href="https://opensea.io/ja/collection/otomo-seireitai" target="_blank" rel="noopener noreferrer"><span>OTOMO 精霊体</span><small>OpenSea ↗</small></a>
                  <a href="https://dex.scenttoken.com/trade" target="_blank" rel="noopener noreferrer"><span>SDT</span><small>SCENT DEX ↗</small></a>
                </div>
              </aside>
            </div>
          )}
        </main>

        {/* Illustrated dock mirroring the primary destinations. Every entry
            routes to a real view; nothing here is a placeholder. */}
        <nav className={styles.dock} aria-label="クイックアクセス">
          <button type="button" onClick={() => changeView("games")}><IconGames className={styles.dockIcon} /><span>ゲーム一覧</span></button>
          <button type="button" onClick={() => changeView("arena")}><IconArena className={styles.dockIcon} /><span>アリーナ</span></button>
          <button type="button" onClick={() => changeView("collection")}><IconVault className={styles.dockIcon} /><span>コレクション</span></button>
          <button type="button" onClick={() => changeView("collection")}><IconOtomo className={styles.dockIcon} /><span>ガチャ</span></button>
          <button type="button" onClick={() => changeView("community")}><IconCommunity className={styles.dockIcon} /><span>コミュニティ</span></button>
          <button type="button" onClick={() => changeView("mysgg")}><IconLedger className={styles.dockIcon} /><span>SGP台帳</span></button>
          <button type="button" onClick={() => changeView("mysgg")}><IconPassport className={styles.dockIcon} /><span>Passport</span></button>
        </nav>

        <footer className={styles.footer}><span>MY SGG / ALL OF SGG, ONE PLAYER OS</span><span>PUBLIC TRUTH · PRIVATE PREFERENCES · NO FABRICATED DATA</span></footer>
      </div>

      <nav className={styles.mobileNav} aria-label="モバイルナビゲーション">
        {navItems.map((item) => (
          <a key={item.id} href={`#${item.id}`} className={activeView === item.id ? styles.mobileNavActive : ""} aria-current={activeView === item.id ? "page" : undefined} onClick={(event) => { event.preventDefault(); changeView(item.id); }}>
            <span aria-hidden="true"><item.Icon className={styles.navIcon} /></span><strong>{item.label}</strong>
          </a>
        ))}
      </nav>

      {nftViewer && (
        <div className={styles.nftViewer} role="dialog" aria-modal="true" aria-label={`${nftViewer.label}の保有一覧`} onClick={(event) => { if (event.target === event.currentTarget) setNftViewer(null); }}>
          <div className={styles.nftViewerPanel}>
            <header>
              <div><small>ONCHAIN COLLECTION</small><strong>{nftViewer.label}</strong><span>{nftPage.total > 0 ? `${nftPage.total}体` : ""}</span></div>
              <button type="button" onClick={() => setNftViewer(null)} aria-label="閉じる">×</button>
            </header>
            {nftState === "error" && <p>読み込みに失敗しました。時間をおいて再度お試しください。</p>}
            {nftState === "loading" && nftTokens.length === 0 && <p>チェーンから保有トークンを読み取っています…</p>}
            <div className={styles.nftStrip}>
              {nftTokens.map((token, index) => (
                <figure key={token.tokenId}>
                  {(token.thumb ?? token.image)
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img
                        src={token.thumb ?? token.image ?? undefined}
                        alt={token.name ?? `#${token.tokenId}`}
                        loading={index < 3 ? "eager" : "lazy"}
                        onError={(event) => {
                          // サムネイル欠落時のみ原寸へ一度だけ差し替える。
                          if (token.image && event.currentTarget.src !== token.image) {
                            event.currentTarget.src = token.image;
                          }
                        }}
                      />
                    : <span className={styles.nftNoImage} aria-hidden="true">画像未取得</span>}
                  <figcaption>{token.name ?? `#${token.tokenId}`}</figcaption>
                </figure>
              ))}
              {nftPage.nextOffset !== null && (
                <button type="button" className={styles.nftMore} onClick={() => void loadMoreNftTokens()} disabled={nftState === "loading"}>
                  {nftState === "loading" ? "読み込み中…" : `続きを見る（残り${nftPage.total - nftTokens.length}）`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {toast && <div className={styles.toast} role="status" aria-live="polite"><span aria-hidden="true">✓</span>{toast}<button type="button" onClick={() => setToast("")} aria-label="通知を閉じる">×</button></div>}
    </div>
  );
}
