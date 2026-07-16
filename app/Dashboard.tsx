"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  assetSources,
  characterPairs,
  communityItems,
  competitions,
  games,
  ledgerSystems,
  otomoForms,
  releaseStateCounts,
  releaseStateLabels,
  systemNotifications,
  type Accent,
  type Competition,
  type GameSummary,
  type ReleaseState,
} from "./dashboard-data";
import { emptyLiveData, type LiveData, type LiveRanking } from "./live-contract";
import styles from "./Dashboard.module.css";

type View = "home" | "games" | "arena" | "collection" | "mysgg" | "community";
type GameFilter = "ALL" | ReleaseState;
type FormFilter = "SPIRIT" | "INCARNATE" | "DOJI";
type SourceState = "online" | "unavailable" | "checking";

const navItems: readonly { id: View; label: string; eyebrow: string; glyph: string }[] = [
  { id: "home", label: "ホーム", eyebrow: "TODAY", glyph: "七" },
  { id: "games", label: "プレイ", eyebrow: "PLAY", glyph: "遊" },
  { id: "arena", label: "アリーナ", eyebrow: "ARENA", glyph: "冠" },
  { id: "collection", label: "コレクション", eyebrow: "VAULT", glyph: "宝" },
  { id: "community", label: "コミュニティ", eyebrow: "FEED", glyph: "繋" },
  { id: "mysgg", label: "マイSGG", eyebrow: "PASSPORT", glyph: "我" },
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

const views = new Set<View>(navItems.map((item) => item.id));
const number = new Intl.NumberFormat("ja-JP");
const runtimeKeyByGameId: Partial<Record<string, keyof LiveData["runtimes"]>> = {
  "otomo-oracle-7": "oracle",
  "otomo-quest-77": "quest",
  "otomo-farm-77": "farm",
  "taiyo-action-rpg": "taiyo",
};

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

function formatSyncAge(value: string, now: number) {
  if (!value) return "未同期";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "未同期";
  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (elapsedSeconds < 45) return "たった今";
  if (elapsedSeconds < 90) return "1分前";
  if (elapsedSeconds < 3600) return `${Math.round(elapsedSeconds / 60)}分前`;
  return formatSyncTime(value);
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={styles.brand}>
      <span className={styles.brandMark} aria-hidden="true">七</span>
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

function GameCard({
  game,
  runtimeState,
  watched,
  onWatch,
  featured = false,
}: {
  game: GameSummary;
  runtimeState: SourceState;
  watched: boolean;
  onWatch: (id: string) => void;
  featured?: boolean;
}) {
  return (
    <article className={featured ? styles.gameCardFeatured : styles.gameCard} data-tone={game.accent}>
      <div className={styles.gameCardTop}>
        <StatusPill accent={game.accent}>
          {game.releaseState === "LIVE" && <Dot active={runtimeState === "online"} />}
          {releaseStateLabels[game.releaseState]}
          {game.releaseState === "LIVE" && ` · ${runtimeState === "online" ? "ONLINE" : runtimeState === "checking" ? "CHECKING" : "稼働確認不可"}`}
        </StatusPill>
        <span>{game.duration === "ACTION" ? "ACTION" : `${game.duration} DAY`}</span>
      </div>
      <div className={styles.gameGlyph} aria-hidden="true">{game.glyph}</div>
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
        {game.officialUrl ? (
          <ExternalLink href={game.officialUrl} className={styles.primaryAction}>
            {game.primaryAction}
          </ExternalLink>
        ) : (
          <button type="button" className={styles.primaryAction} onClick={() => onWatch(game.id)}>
            {watched ? "ウォッチ中" : game.primaryAction}<span aria-hidden="true">{watched ? "✓" : "+"}</span>
          </button>
        )}
        {game.rankingUrl && <ExternalLink href={game.rankingUrl}>ランキング</ExternalLink>}
        {game.guideUrl && <ExternalLink href={game.guideUrl}>ガイド</ExternalLink>}
      </div>
    </article>
  );
}

function CompetitionCard({ competition, runtimeState }: { competition: Competition; runtimeState: SourceState }) {
  return (
    <article className={styles.competitionCard} data-tone={competition.accent}>
      <div>
        <StatusPill accent={competition.accent}>
          <Dot active={runtimeState === "online"} />公開ランキング · {runtimeState === "online" ? "ONLINE" : runtimeState === "checking" ? "CHECKING" : "稼働確認不可"}
        </StatusPill>
        <span>{competition.cadence}</span>
      </div>
      <p>{competition.game}</p>
      <h3>{competition.title}</h3>
      <dl>
        <div><dt>RULE</dt><dd>{competition.rule}</dd></div>
        <div><dt>DATA</dt><dd>{competition.integrity}</dd></div>
      </dl>
      {competition.href && (
        <ExternalLink href={competition.href} className={styles.primaryAction}>
          {competition.actionLabel}
        </ExternalLink>
      )}
    </article>
  );
}

function Leaderboard({
  title,
  subtitle,
  entries,
  state,
  accent,
}: {
  title: string;
  subtitle: string;
  entries: LiveRanking[];
  state: SourceState;
  accent: Accent;
}) {
  return (
    <section className={styles.leaderboard} data-tone={accent}>
      <div className={styles.leaderboardHead}>
        <div><p>LIVE PUBLIC DATA</p><h3>{title}</h3><span>{subtitle}</span></div>
        <StatusPill accent={accent}><Dot active={state === "online"} />{state === "online" ? "同期済み" : state === "checking" ? "同期中" : "一時取得不可"}</StatusPill>
      </div>
      {entries.length ? (
        <ol>
          {entries.slice(0, 5).map((entry) => (
            <li key={`${entry.rank}-${entry.name}`}>
              <span>{String(entry.rank).padStart(2, "0")}</span>
              <div><strong>{entry.name}</strong><small>{entry.meta}</small></div>
              <b>{number.format(entry.score)}</b>
            </li>
          ))}
        </ol>
      ) : state === "checking" ? (
        <ol className={styles.leaderboardSkeleton} aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <li key={index}>
              <span /><div><strong /><small /></div><b />
            </li>
          ))}
        </ol>
      ) : (
        <div className={styles.inlineEmpty}>
          <span aria-hidden="true">↻</span>
          <p>{state === "online"
            ? "この番付には、まだ公開記録がありません。"
            : "公開ランキングを取得できませんでした。公式ページでは引き続き確認できます。"}</p>
        </div>
      )}
    </section>
  );
}

export function Dashboard() {
  const [activeView, setActiveView] = useState<View>("home");
  const [gameFilter, setGameFilter] = useState<GameFilter>("ALL");
  const [formFilter, setFormFilter] = useState<FormFilter>("SPIRIT");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [followedChannels, setFollowedChannels] = useState<Set<string>>(new Set(["X"]));
  const [liveData, setLiveData] = useState<LiveData>(emptyLiveData);
  const [liveState, setLiveState] = useState<"loading" | "ready" | "error">("loading");
  const [syncing, setSyncing] = useState(false);
  const [clock, setClock] = useState(0);
  const [toast, setToast] = useState("");
  const mainRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const checkedAtRef = useRef("");

  const activeNav = navItems.find((item) => item.id === activeView) ?? navItems[0];
  const unread = systemNotifications.filter((item) => !readIds.has(item.id));

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
      ["my-sgg-read", setReadIds],
      ["my-sgg-followed", setFollowedChannels],
    ] as const) {
      try {
        const stored = window.localStorage.getItem(key);
        if (stored) setter(new Set(JSON.parse(stored) as string[]));
      } catch {
        // Device-local preferences are optional; malformed storage is ignored.
      }
    }
  }, []);

  const syncLiveData = useCallback(async (options?: { force?: boolean; announceFailure?: boolean }) => {
    setSyncing(true);
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
    } finally {
      setSyncing(false);
    }
  }, []);

  const loadLiveData = useCallback(
    () => syncLiveData({ force: true, announceFailure: true }),
    [syncLiveData],
  );

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

  // Low-frequency clock so「たった今 / N分前」stays honest without re-fetching.
  useEffect(() => {
    const tick = () => setClock(Date.now());
    const timeout = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

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
    const isTypingTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
        return;
      }
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
        return;
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Popovers close on outside interaction, matching standard menu behavior.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (searchBoxRef.current && !searchBoxRef.current.contains(target)) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
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
    setSearch("");
    setSearchOpen(false);
    setNotificationsOpen(false);
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

  const markRead = (id: string, target: View) => {
    const next = new Set(readIds).add(id);
    setReadIds(next);
    const saved = persistSet("my-sgg-read", next);
    if (!saved) setToast("この端末では既読状態を保存できません");
    changeView(target);
  };

  const markAllRead = () => {
    const next = new Set(systemNotifications.map((item) => item.id));
    setReadIds(next);
    const saved = persistSet("my-sgg-read", next);
    if (!saved) setToast("この端末では既読状態を保存できません");
  };

  const toggleChannel = (channel: string) => {
    const next = new Set(followedChannels);
    if (next.has(channel)) next.delete(channel);
    else next.add(channel);
    setFollowedChannels(next);
    const saved = persistSet("my-sgg-followed", next);
    setToast(saved
      ? next.has(channel) ? `${channel}の購読希望をこの端末に保存しました` : `${channel}の購読希望を解除しました`
      : "この端末では購読希望を保存できません");
  };

  const searchResults = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ja");
    if (!query) return [];
    const results: { id: string; category: string; title: string; meta: string; view: View }[] = [];
    for (const game of games) {
      if (`${game.title} ${game.subtitle} ${game.genre} ${game.description}`.toLocaleLowerCase("ja").includes(query)) {
        results.push({ id: game.id, category: "PLAY", title: game.title, meta: game.subtitle, view: "games" });
      }
    }
    for (const item of competitions) {
      if (`${item.title} ${item.game} ${item.rule}`.toLocaleLowerCase("ja").includes(query)) {
        results.push({ id: item.id, category: "ARENA", title: item.title, meta: item.game, view: "arena" });
      }
    }
    for (const pair of characterPairs) {
      if (`${pair.godName} ${pair.godId} ${pair.otomoName} ${pair.otomoId}`.toLocaleLowerCase("ja").includes(query)) {
        results.push({ id: pair.otomoId, category: "COLLECTION", title: `${pair.godName} × ${pair.otomoName}`, meta: `${pair.godId} / ${pair.otomoId}`, view: "collection" });
      }
    }
    for (const item of communityItems) {
      if (`${item.title} ${item.channel} ${item.description}`.toLocaleLowerCase("ja").includes(query)) {
        results.push({ id: item.id, category: "FEED", title: item.title, meta: item.channel, view: "community" });
      }
    }
    return results.slice(0, 8);
  }, [search]);

  const activeResultIndex = searchResults.length
    ? Math.min(activeSearchIndex, searchResults.length - 1)
    : -1;

  const selectSearchResult = (index: number) => {
    const result = searchResults[index];
    if (result) changeView(result.view);
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!searchOpen || !searchResults.length) {
      if (event.key === "Escape") setSearchOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSearchIndex((current) => (current + 1) % searchResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSearchIndex((current) => (current - 1 + searchResults.length) % searchResults.length);
    } else if (event.key === "Enter" && activeResultIndex >= 0) {
      event.preventDefault();
      selectSearchResult(activeResultIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setSearchOpen(false);
    }
  };

  const filteredGames = games.filter((game) => gameFilter === "ALL" || game.releaseState === gameFilter);
  const featuredGame = filteredGames.find((game) => game.featured) ?? filteredGames[0];
  const libraryGames = featuredGame
    ? filteredGames.filter((game) => game.id !== featuredGame.id)
    : filteredGames;
  const currentForm = otomoForms.find((form) => form.code === formFilter) ?? otomoForms[0];
  const getRuntimeState = (gameId: string): SourceState => {
    const runtimeKey = runtimeKeyByGameId[gameId];
    if (liveState === "loading") return "checking";
    if (liveState === "error" || !runtimeKey) return "unavailable";
    return liveData.runtimes[runtimeKey];
  };
  const oracleSourceState: SourceState = liveState === "loading" ? "checking" : liveData.sources.oracle;
  const questSourceState: SourceState = liveState === "loading" ? "checking" : liveData.sources.quest;
  const runtimeSummary = liveState === "loading"
    ? "CHECKING"
    : liveState === "error"
      ? "HEALTH UNAVAILABLE"
      : `${liveData.runtimeOnlineCount} / 4 ONLINE`;

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
              <span className={styles.navGlyph} aria-hidden="true">{item.glyph}</span>
              <span><small>{item.eyebrow}</small><strong>{item.label}</strong></span>
            </a>
          ))}
        </nav>
        <section className={styles.sidebarStatus}>
          <span><Dot active={liveState === "ready" && liveData.runtimeOnlineCount === 4} />{runtimeSummary}</span>
          <small>PLAYER DATA BRIDGE · NOT CONNECTED</small>
        </section>
      </aside>

      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.mobileBrand}><Brand compact /></div>
          <div className={styles.breadcrumb}><span>MY SGG</span><i>/</i><strong>{activeNav.label}</strong></div>
          <div className={styles.searchBox} ref={searchBoxRef}>
            <label className={styles.srOnly} htmlFor="global-search">SGG全体を検索</label>
            <span aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              id="global-search"
              type="search"
              role="combobox"
              aria-expanded={searchOpen && Boolean(search)}
              aria-controls="global-search-results"
              aria-autocomplete="list"
              aria-activedescendant={searchOpen && activeResultIndex >= 0 ? `global-search-option-${activeResultIndex}` : undefined}
              placeholder="ゲーム・番付・キャラクター・更新を検索"
              value={search}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); setActiveSearchIndex(0); }}
              onKeyDown={handleSearchKeyDown}
            />
            <kbd>⌘ K</kbd>
            {searchOpen && search && (
              <div id="global-search-results" className={styles.searchResults} role="listbox" aria-label="検索結果">
                <p>SEARCH / {searchResults.length} RESULTS</p>
                {searchResults.length ? searchResults.map((result, index) => (
                  <button
                    id={`global-search-option-${index}`}
                    key={`${result.category}-${result.id}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={activeResultIndex === index}
                    onMouseEnter={() => setActiveSearchIndex(index)}
                    onClick={() => selectSearchResult(index)}
                  >
                    <span>{result.category}</span><strong>{result.title}</strong><small>{result.meta}</small>
                  </button>
                )) : <div className={styles.searchEmpty}>一致する公開情報はありません</div>}
              </div>
            )}
          </div>
          <div className={styles.topActions}>
            <button type="button" className={styles.iconButton} onClick={() => void loadLiveData()} aria-label="公開データを再同期" aria-busy={syncing} disabled={syncing}>
              <span aria-hidden="true" className={syncing ? styles.spin : undefined}>↻</span>
            </button>
            <div className={styles.notificationWrap} ref={notificationRef}>
              <button type="button" className={styles.iconButton} aria-label={`通知 ${unread.length}件`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}>
                <span aria-hidden="true">◌</span>{unread.length > 0 && <b>{unread.length}</b>}
              </button>
              {notificationsOpen && (
                <div className={styles.notificationPanel}>
                  <div><strong>アクション通知</strong><button type="button" onClick={markAllRead}>すべて既読</button></div>
                  {systemNotifications.map((item) => (
                    <button key={item.id} type="button" className={readIds.has(item.id) ? "" : styles.notificationUnread} onClick={() => markRead(item.id, item.target)}>
                      <span>{item.kind}</span><strong>{item.title}</strong><small>{item.detail}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className={styles.profileButton} onClick={() => changeView("mysgg")}>
              <span aria-hidden="true">MY</span><div><small>PLAYER PASSPORT</small><strong>未接続</strong></div>
            </button>
          </div>
        </header>

        <main id="main-content" ref={mainRef} tabIndex={-1} className={styles.content}>
          <p className={styles.srOnly} aria-live="polite">{activeNav.label}を表示中</p>
          <div className={styles.truthBanner} role="status">
            <span><Dot active={liveState === "ready" && liveData.runtimeOnlineCount > 0} />LIVE SOURCES</span>
            <p>公開確認済みのゲーム・ランキング・投稿だけを表示。個人データは共通認証が接続されるまで「未接続」です。</p>
            <small title={liveData.checkedAt ? `同期時刻 ${formatSyncTime(liveData.checkedAt)} MYT` : undefined}>
              SYNC {formatSyncAge(liveData.checkedAt, clock)}
              {liveData.servedFrom === "cache" && " · 共有snapshot"}
            </small>
          </div>

          {activeView === "home" && (
            <div className={styles.viewStack}>
              <section className={styles.hero} aria-labelledby="hero-title">
                <Image src="/dashboard-art/my-sgg-triform-candidate-v1.png" alt="鯛丸の精霊体、受肉体、童子が並ぶMY SGGの神域" fill priority sizes="(max-width: 900px) 100vw, 82vw" />
                <div className={styles.heroShade} />
                <div className={styles.heroCopy}>
                  <p>SEVENGODS GAMES / PLAYER OS</p>
                  <h1 id="hero-title">遊ぶ。競う。集める。<br /><em>すべてを、ひとつに。</em></h1>
                  <span>公開中のゲーム、神託番付、キャラクター図鑑、公式アップデートを一つの司令席から。</span>
                  <div>
                    <button type="button" onClick={() => changeView("games")}>今すぐ遊ぶ<span aria-hidden="true">→</span></button>
                    <button type="button" onClick={() => changeView("arena")}>ライブ番付を見る</button>
                  </div>
                </div>
                <div className={styles.heroSignal}>
                  <small>NETWORK</small><strong>{runtimeSummary}</strong><span>LIVE HEALTH · {formatSyncTime(liveData.checkedAt)}</span>
                </div>
              </section>

              <section className={styles.metricStrip} aria-label="SGG公開状態">
                <button type="button" onClick={() => changeView("games")}><small>PLAYABLE</small><strong>{releaseStateCounts.LIVE}</strong><span>公開runtime</span></button>
                <button type="button" onClick={() => changeView("arena")}><small>LIVE BOARDS</small><strong>{competitions.length}</strong><span>公開番付</span></button>
                <button type="button" onClick={() => changeView("collection")}><small>CANON PAIRS</small><strong>{characterPairs.length}</strong><span>GODS × OTOMO</span></button>
                <button type="button" onClick={() => changeView("community")}><small>PUBLISHED</small><strong>02</strong><span>公式更新</span></button>
              </section>

              <section className={styles.todaySection}>
                <SectionTitle kicker="TODAY / PLAY NOW" title="いま戻る場所" copy="ログイン後の進行は各ゲームで安全に確認。公開プレイはここから直接起動できます。" action={<button type="button" className={styles.textButton} onClick={() => changeView("games")}>全ゲームを見る →</button>} />
                <div className={styles.todayGrid}>
                  {games.filter((game) => game.releaseState === "LIVE").map((game) => {
                    const runtimeState = getRuntimeState(game.id);
                    return <article key={game.id} data-tone={game.accent}>
                      <div className={styles.todayGlyph} aria-hidden="true">{game.glyph}</div>
                      <span><Dot active={runtimeState === "online"} />{game.shortTitle} · {runtimeState === "online" ? "ONLINE" : runtimeState === "checking" ? "CHECKING" : "稼働確認不可"}</span>
                      <h3>{game.nextAction}</h3>
                      <p>{game.nextActionMeta}</p>
                      {game.officialUrl && <ExternalLink href={game.officialUrl}>{game.primaryAction}</ExternalLink>}
                    </article>;
                  })}
                </div>
              </section>

              <div className={styles.homeGrid}>
                <Leaderboard title="神託番付" subtitle={`OTOMO ORACLE 7 · DAY ${liveData.oracle.day ?? "—"}`} entries={liveData.oracle.entries} state={oracleSourceState} accent="cyan" />
                <section className={styles.feedPreview}>
                  <SectionTitle kicker="OFFICIAL FEED" title="公開済みアップデート" copy="公開台帳が確認できた投稿のみ。" />
                  {communityItems.filter((item) => item.status === "PUBLISHED").map((item) => (
                    <article key={item.id} data-tone={item.accent}>
                      <span>{item.channel} · {item.dateLabel}</span>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      {item.href && <ExternalLink href={item.href}>{item.actionLabel}</ExternalLink>}
                    </article>
                  ))}
                  <button type="button" className={styles.textButton} onClick={() => changeView("community")}>コミュニティセンターへ →</button>
                </section>
              </div>
            </div>
          )}

          {activeView === "games" && (
            <div className={styles.viewStack}>
              <header className={styles.pageHeader}>
                <div><p>PLAY / GAME UNIVERSE</p><h1>SGGを遊ぶ</h1><span>公開状態、進行タイプ、公式URLを正本とlive healthから統合。</span></div>
                <div className={styles.pageStats}><span><b>{releaseStateCounts.LIVE}</b>PLAYABLE</span><span><b>{releaseStateCounts.DRAFT}</b>IN DEVELOPMENT</span><span><b>7·77·777</b>TIME AXES</span></div>
              </header>
              <div className={styles.filterBar} aria-label="ゲーム公開状態フィルター">
                {(["ALL", "LIVE", "DRAFT"] as GameFilter[]).map((filter) => (
                  <button key={filter} type="button" aria-pressed={gameFilter === filter} className={gameFilter === filter ? styles.filterActive : ""} onClick={() => setGameFilter(filter)}>
                    {filter === "ALL" ? "すべて" : releaseStateLabels[filter]}
                  </button>
                ))}
              </div>
              {featuredGame && <GameCard game={featuredGame} runtimeState={getRuntimeState(featuredGame.id)} watched={watchedIds.has(featuredGame.id)} onWatch={toggleWatched} featured />}
              <section>
                <SectionTitle kicker="VERIFIED CATALOG" title="ゲームライブラリ" copy={`${filteredGames.length}タイトルを表示`} />
                <div className={styles.gameGrid}>
                  {libraryGames.map((game) => <GameCard key={game.id} game={game} runtimeState={getRuntimeState(game.id)} watched={watchedIds.has(game.id)} onWatch={toggleWatched} />)}
                </div>
              </section>
              <section className={styles.timeAxes}>
                <article><span>7</span><div><strong>熱狂</strong><p>短時間の挑戦・競争・更新</p></div></article>
                <article><span>77</span><div><strong>物語</strong><p>育成・待機・探索・シーズン</p></div></article>
                <article><span>777</span><div><strong>未来</strong><p>共同で積み重ねる長期構想</p></div></article>
              </section>
            </div>
          )}

          {activeView === "arena" && (
            <div className={styles.viewStack}>
              <header className={styles.pageHeader}>
                <div><p>ARENA / VERIFIED COMPETITION</p><h1>アリーナ</h1><span>公開APIと公開ページで確認できる競争だけを表示します。</span></div>
                <button type="button" className={styles.refreshButton} onClick={() => void loadLiveData()} disabled={syncing}>{syncing ? "同期中…" : "公開データを再同期"}</button>
              </header>
              <div className={styles.arenaBoards}>
                <Leaderboard title="神託番付" subtitle={`ORACLE DAY ${liveData.oracle.day ?? "—"} / RAW SCORE`} entries={liveData.oracle.entries} state={oracleSourceState} accent="cyan" />
                <Leaderboard
                  title="シーズン序列"
                  subtitle={liveData.quest.season ? `${liveData.quest.season.name} · DAY ${liveData.quest.season.day}/${liveData.quest.season.totalDays} · ${liveData.quest.participants} PLAYERS` : "QUEST 77 / GAME PROGRESS METRIC"}
                  entries={liveData.quest.entries}
                  state={questSourceState}
                  accent="violet"
                />
              </div>
              <section>
                <SectionTitle kicker="PUBLIC BOARDS" title="公開ランキング" copy="順位の意味はゲームごとに異なり、SGG_GAME_POINTSや資産保有とは分離されます。" />
                <div className={styles.competitionGrid}>{competitions.map((item) => <CompetitionCard key={item.id} competition={item} runtimeState={getRuntimeState(item.gameId)} />)}</div>
              </section>
              <section className={styles.eventEmpty}>
                <span aria-hidden="true">冠</span>
                <div><p>PUBLISHED EVENTS</p><h2>現在、公開確認済みの大会はありません</h2><span>公式発表と参加導線が確認されると、受付・締切・戦績がここに表示されます。</span></div>
              </section>
              <aside className={styles.integrityNote}><strong>FAIR PLAY</strong><p>raw gameplay → ranking → SGG_GAME_POINTS → reward candidateを別々に扱います。Walletや保有資産で順位を変えません。</p></aside>
            </div>
          )}

          {activeView === "collection" && (
            <div className={styles.viewStack}>
              <header className={styles.pageHeader}>
                <div><p>COLLECTION / SOURCE-AWARE VAULT</p><h1>コレクション</h1><span>オンチェーン保有、ゲーム内資産、公式キャラクター図鑑を混ぜずに統合。</span></div>
                <div className={styles.pageStats}><span><b>7</b>PAIRS</span><span><b>3</b>FORMS</span><span><b>未接続</b>MY ASSETS</span></div>
              </header>
              <section className={styles.connectionEmpty}>
                <div className={styles.connectionIcon} aria-hidden="true">◇</div>
                <div><p>MY ASSET BRIDGE</p><h2>あなたの保有データはまだ接続されていません</h2><span>共通Discord identityと署名済みplayer snapshot APIが接続されると、Walletと各ゲームの資産がここへ集約されます。</span></div>
                <StatusPill accent="gold">WALLET OPTIONAL</StatusPill>
              </section>
              <section>
                <SectionTitle kicker="ASSET SOURCES" title="接続する資産ソース" copy="missingを0件と表示せず、未接続・要ログイン・利用可能を区別します。" />
                <div className={styles.sourceGrid}>
                  {assetSources.map((source) => (
                    <article key={source.id} data-tone={source.accent}>
                      <span>{source.kind}</span><h3>{source.label}</h3><p>{source.description}</p>
                      <StatusPill accent={source.accent}>{source.status}</StatusPill>
                      {source.href ? <ExternalLink href={source.href}>ゲームで確認</ExternalLink> : <button type="button" disabled>{source.status === "CONNECT" ? "共通Wallet連携を準備中" : "この画面で確認"}</button>}
                    </article>
                  ))}
                </div>
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
                      <div className={styles.pairGlyph} aria-hidden="true">{pair.glyph}</div>
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
              <header className={styles.pageHeader}>
                <div><p>MY SGG / PLAYER PASSPORT</p><h1>マイSGG</h1><span>本人、履歴、ポイント、報酬、セキュリティを一つに。制度は混ぜません。</span></div>
                <StatusPill accent="coral">PLAYER BRIDGE · NOT CONNECTED</StatusPill>
              </header>
              <section className={styles.passportHero}>
                <div className={styles.passportMark} aria-hidden="true">MY</div>
                <div><small>UNIFIED PLAYER ID</small><h2>SGG Player Passport</h2><p>正式identityはDiscord user ID。Walletは任意で、未接続でもゲームとraw rankingへ参加できます。</p></div>
                <div className={styles.passportStatus}>
                  <span><Dot />Discord<strong>未接続</strong></span>
                  <span><Dot />Wallet<strong>任意</strong></span>
                  <span><Dot />Passkey<strong>準備中</strong></span>
                </div>
              </section>
              <div className={styles.identityGrid}>
                <article data-tone="violet"><span>01</span><h3>Discord Identity</h3><p>ゲームごとに分かれたsessionを、server-sideの署名済みassertionで一人のプレイヤーへ統合。</p><StatusPill accent="violet">CENTRAL BRIDGE REQUIRED</StatusPill></article>
                <article data-tone="gold"><span>02</span><h3>Optional Wallet</h3><p>1 Discord ↔ 1 Wallet。保有確認はsnapshot時刻とchain基準点を記録します。</p><StatusPill accent="gold">PLAY WITHOUT WALLET</StatusPill></article>
                <article data-tone="cyan"><span>03</span><h3>Account Protection</h3><p>Passkey、復旧コード、再認証、待機期間、session失効、append-only監査を設計。</p><StatusPill accent="cyan">SECURITY FIRST</StatusPill></article>
              </div>
              <section>
                <SectionTitle kicker="TRUSTED LEDGER" title="記録と経済の境界" copy="未接続の値を0にせず、取得元・制度・確定状態を明示します。" />
                <div className={styles.ledgerGrid}>
                  {ledgerSystems.map((system) => (
                    <article key={system.id} data-tone={system.accent}>
                      <div><span>{system.category}</span><StatusPill accent={system.accent}>{system.status}</StatusPill></div>
                      <h3>{system.label}</h3><p>{system.description}</p><small>SOURCE / {system.source}</small>
                    </article>
                  ))}
                </div>
              </section>
              <aside className={styles.tokenBoundary}><span aria-hidden="true">!</span><div><strong>SGG TokenはPLANNEDです</strong><p>chain、contract、供給量、公開日、価格は未確定。ポイント残高や報酬からToken価値を推測しません。</p></div></aside>
            </div>
          )}

          {activeView === "community" && (
            <div className={styles.viewStack}>
              <header className={styles.pageHeader}>
                <div><p>COMMUNITY / OFFICIAL SIGNALS</p><h1>コミュニティ</h1><span>公開済みニュース、参加導線、学び、貢献を一つのフィードへ。</span></div>
                <div className={styles.pageStats}><span><b>02</b>PUBLISHED</span><span><b>02</b>PREPARING</span><span><b>01</b>MVP DEMO</span></div>
              </header>
              <div className={styles.communityLayout}>
                <section>
                  <SectionTitle kicker="OFFICIAL & COMMUNITY HUB" title="コミュニティハブ" copy="公開済み、準備中、MVP／DEMOを状態ラベルで分離して掲載。" />
                  <div className={styles.communityFeed}>
                    {communityItems.map((item) => (
                      <article key={item.id} data-tone={item.accent}>
                        <div><StatusPill accent={item.accent}>{item.status}</StatusPill><span>{item.channel} · {item.dateLabel}</span></div>
                        <h3>{item.title}</h3><p>{item.description}</p>
                        {item.href ? <ExternalLink href={item.href}>{item.actionLabel}</ExternalLink> : <button type="button" disabled>{item.actionLabel}</button>}
                      </article>
                    ))}
                  </div>
                </section>
                <aside className={styles.followPanel}>
                  <p>MY SIGNALS</p><h2>購読希望</h2><span>この端末だけに保存する希望設定です。外部通知はまだ配信しません。</span>
                  {["X", "DISCORD", "SUBSTACK", "SEVENDAO"].map((channel) => (
                    <label key={channel}><input type="checkbox" checked={followedChannels.has(channel)} onChange={() => toggleChannel(channel)} /><span>{channel}</span><small>{followedChannels.has(channel) ? "ON" : "OFF"}</small></label>
                  ))}
                </aside>
              </div>
              <section className={styles.eventEmpty}>
                <span aria-hidden="true">暦</span><div><p>COMMUNITY EVENTS</p><h2>現在、公開確認済みのイベントはありません</h2><span>公式発表が確認されると、日時・参加方法・チェックインがここに表示されます。</span></div>
              </section>
              <aside className={styles.integrityNote}><strong>PUBLICATION RULE</strong><p>APPROVEDやREVIEWは公開済みではありません。Xは公開台帳、Discordは送信記録、Dispatchは公開URLを確認してから表示します。</p></aside>
            </div>
          )}
        </main>

        <footer className={styles.footer}><span>MY SGG / ALL OF SGG, ONE PLAYER OS</span><span>PUBLIC TRUTH · PRIVATE PREFERENCES · NO FABRICATED DATA</span></footer>
      </div>

      <nav className={styles.mobileNav} aria-label="モバイルナビゲーション">
        {navItems.map((item) => (
          <a key={item.id} href={`#${item.id}`} className={activeView === item.id ? styles.mobileNavActive : ""} aria-current={activeView === item.id ? "page" : undefined} onClick={(event) => { event.preventDefault(); changeView(item.id); }}>
            <span aria-hidden="true">{item.glyph}</span><strong>{item.label}</strong>
          </a>
        ))}
      </nav>

      {toast && <div className={styles.toast} role="status" aria-live="polite"><span aria-hidden="true">✓</span>{toast}<button type="button" onClick={() => setToast("")} aria-label="通知を閉じる">×</button></div>}
    </div>
  );
}
