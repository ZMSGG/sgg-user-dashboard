export type Accent = "cyan" | "violet" | "coral" | "gold" | "green";

export type ReleaseState = "LIVE" | "DRAFT" | "NOT_DEPLOYED";
export type SyncMode = "PUBLIC" | "AUTH_REQUIRED" | "UNAVAILABLE";

export type GameSummary = {
  id: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  description: string;
  releaseState: ReleaseState;
  releaseLabel: string;
  sourceLabel: string;
  syncMode: SyncMode;
  accent: Accent;
  glyph: string;
  genre: string;
  duration: "7" | "77" | "777" | "ACTION";
  officialUrl: string | null;
  rankingUrl: string | null;
  guideUrl: string | null;
  primaryAction: string;
  nextAction: string;
  nextActionMeta: string;
  featured?: boolean;
};

export const games: readonly GameSummary[] = [
  {
    id: "otomo-quest-77",
    title: "OTOMO QUEST 77",
    shortTitle: "QUEST 77",
    subtitle: "派遣・待機・探索・進化",
    description:
      "7体のOTOMOを神域へ派遣し、帰還を待ち、素材と成長を積み上げる77日シーズン。",
    releaseState: "LIVE",
    releaseLabel: "EXISTING RUNTIME ONLINE · RELEASE REVIEW",
    sourceLabel: "HTTP 200 VERIFIED · 2026.07.14",
    syncMode: "AUTH_REQUIRED",
    accent: "violet",
    glyph: "Q7",
    genre: "LONG-FORM EXPEDITION",
    duration: "77",
    officialUrl: "https://otomoquest.sevengodsgames.com/",
    rankingUrl: "https://otomoquest.sevengodsgames.com/ranking",
    guideUrl: "https://otomoquest.sevengodsgames.com/guide",
    primaryAction: "QUESTを開く",
    nextAction: "帰還・派遣状況を確認",
    nextActionMeta: "Discordログイン後にゲーム側で同期",
    featured: true,
  },
  {
    id: "otomo-farm-77",
    title: "OTOMO FARM 77",
    shortTitle: "FARM 77",
    subtitle: "育成・収穫・資源蓄積",
    description:
      "神域の畑で種をまき、収穫し、OTOMOを育てる77日シーズン。自動農作業にも対応。",
    releaseState: "LIVE",
    releaseLabel: "EXISTING RUNTIME ONLINE · LATEST 2026.07.13",
    sourceLabel: "HTTP 200 VERIFIED · 2026.07.14",
    syncMode: "AUTH_REQUIRED",
    accent: "green",
    glyph: "F7",
    genre: "LONG-FORM FARMING",
    duration: "77",
    officialUrl: "https://otomofarm.sevengodsgames.com/",
    rankingUrl: "https://otomofarm.sevengodsgames.com/rankings",
    guideUrl: null,
    primaryAction: "FARMを開く",
    nextAction: "収穫・畑の状態を確認",
    nextActionMeta: "Discordログイン後にゲーム側で同期",
  },
  {
    id: "otomo-oracle-7",
    title: "OTOMO ORACLE 7",
    shortTitle: "ORACLE 7",
    subtitle: "七柱の神託を読み解く",
    description:
      "7体のOTOMOを神座へ配置する、1日1問の空間ロジックゲーム。練習と神託番付を公開中。",
    releaseState: "LIVE",
    releaseLabel: "PUBLIC RUNTIME VERIFIED",
    sourceLabel: "HTTP 200 VERIFIED · 2026.07.14",
    syncMode: "PUBLIC",
    accent: "cyan",
    glyph: "O7",
    genre: "DAILY LOGIC",
    duration: "7",
    officialUrl: "https://otomooracle.sevengodsgames.com/",
    rankingUrl: "https://otomooracle.sevengodsgames.com/ranking",
    guideUrl: "https://otomooracle.sevengodsgames.com/guide",
    primaryAction: "本日の神託へ",
    nextAction: "今日の問題に挑戦",
    nextActionMeta: "公開プレイ · 毎日更新",
  },
  {
    id: "taiyo-action-rpg",
    title: "TAIYO —大黒天—",
    shortTitle: "TAIYO",
    subtitle: "宵闇の神楽林を駆ける",
    description:
      "大黒天の神装をまとったTAIYOで駆ける、ハイスピード2DアクションRPG。",
    releaseState: "LIVE",
    releaseLabel: "PUBLIC RUNTIME V5 VERIFIED",
    sourceLabel: "HTTP 200 VERIFIED · 2026.07.14",
    syncMode: "PUBLIC",
    accent: "gold",
    glyph: "大",
    genre: "ACTION RPG",
    duration: "ACTION",
    officialUrl: "https://emberveil.sevengodsgames.com/",
    rankingUrl: null,
    guideUrl: null,
    primaryAction: "神楽林へ",
    nextAction: "新しいRUNを開始",
    nextActionMeta: "公開プレイ",
  },
  {
    id: "ebisu-fishing-77",
    title: "EBISU FISHING 77",
    shortTitle: "FISHING 77",
    subtitle: "潮を読み、仕掛けを最適化する",
    description:
      "11の潮を77時間で巡る放置釣りゲーム。仕様・進行・データ設計を準備中。",
    releaseState: "DRAFT",
    releaseLabel: "SPEC ONLY DRAFT",
    sourceLabel: "PROJECT REGISTRY · 2026.07.14",
    syncMode: "UNAVAILABLE",
    accent: "coral",
    glyph: "釣",
    genre: "IDLE FISHING",
    duration: "77",
    officialUrl: null,
    rankingUrl: null,
    guideUrl: null,
    primaryAction: "この端末でウォッチ",
    nextAction: "リリース待ち",
    nextActionMeta: "日程未確定 · ウォッチ設定のみ",
  },
] as const;

export type Competition = {
  id: string;
  gameId: string;
  title: string;
  game: string;
  status: "LIVE_RANKING" | "PLANNED";
  cadence: string;
  rule: string;
  integrity: string;
  actionLabel: string;
  href: string | null;
  accent: Accent;
};

export const competitions: readonly Competition[] = [
  {
    id: "oracle-daily-ranking",
    gameId: "otomo-oracle-7",
    title: "神託番付",
    game: "OTOMO ORACLE 7",
    status: "LIVE_RANKING",
    cadence: "DAILY",
    rule: "問題ごとのraw score・完了状態",
    integrity: "PUBLIC API VERIFIED",
    actionLabel: "番付を見る",
    href: "https://otomooracle.sevengodsgames.com/ranking",
    accent: "cyan",
  },
  {
    id: "quest-season-ranking",
    gameId: "otomo-quest-77",
    title: "シーズン序列",
    game: "OTOMO QUEST 77",
    status: "LIVE_RANKING",
    cadence: "77-DAY SEASON",
    rule: "探索・育成のシーズン集計",
    integrity: "PUBLIC API VERIFIED",
    actionLabel: "序列を見る",
    href: "https://otomoquest.sevengodsgames.com/ranking",
    accent: "violet",
  },
  {
    id: "farm-season-ranking",
    gameId: "otomo-farm-77",
    title: "神域番付",
    game: "OTOMO FARM 77",
    status: "LIVE_RANKING",
    cadence: "77-DAY SEASON",
    rule: "収穫・親密度・奉納など5部門",
    integrity: "PUBLIC PAGE VERIFIED",
    actionLabel: "番付を見る",
    href: "https://otomofarm.sevengodsgames.com/rankings",
    accent: "green",
  },
] as const;

export type CharacterPair = {
  godId: string;
  godName: string;
  otomoId: string;
  otomoName: string;
  glyph: string;
  accent: Accent;
};

export const characterPairs: readonly CharacterPair[] = [
  { godId: "EBISU", godName: "恵比寿", otomoId: "TAIMARU", otomoName: "鯛丸", glyph: "鯛", accent: "coral" },
  { godId: "TAIYO", godName: "大耀", otomoId: "KOZUCHI", otomoName: "小槌", glyph: "槌", accent: "gold" },
  { godId: "SOBI", godName: "蒼毘", otomoId: "MOMOKATSU", otomoName: "百勝", glyph: "百", accent: "cyan" },
  { godId: "SAIKA", godName: "彩華", otomoId: "KOTONE", otomoName: "琴音", glyph: "琴", accent: "violet" },
  { godId: "JURAKU", godName: "寿楽", otomoId: "JUKA", otomoName: "寿鹿", glyph: "寿", accent: "green" },
  { godId: "FUKUEI", godName: "福栄", otomoId: "HAKU", otomoName: "ハク", glyph: "白", accent: "cyan" },
  { godId: "SHOUREN", godName: "笑蓮", otomoId: "SHOFUKU", otomoName: "笑袋", glyph: "笑", accent: "gold" },
] as const;

export const otomoForms = [
  { code: "SPIRIT", label: "精霊体", description: "相棒との出会い・探索の入口", accent: "cyan" as Accent },
  { code: "INCARNATE", label: "受肉体", description: "成長・制作・中盤の深化", accent: "coral" as Accent },
  { code: "DOJI", label: "童子", description: "成熟・戦略・コレクション", accent: "violet" as Accent },
] as const;

export type AssetSource = {
  id: string;
  label: string;
  kind: "ONCHAIN" | "GAME" | "CATALOG";
  status: "CONNECT" | "LOGIN" | "AVAILABLE" | "PLANNED";
  description: string;
  href: string | null;
  accent: Accent;
};

export const assetSources: readonly AssetSource[] = [
  {
    id: "wallet",
    label: "Wallet Assets",
    kind: "ONCHAIN",
    status: "CONNECT",
    description: "GODS・OTOMOのオンチェーン保有。Walletはプレイ条件ではありません。",
    href: null,
    accent: "gold",
  },
  {
    id: "quest-assets",
    label: "QUEST 77 Assets",
    kind: "GAME",
    status: "LOGIN",
    description: "OTOMO、G精霊体・G受肉体・G童子、素材、探索記録。",
    href: "https://otomoquest.sevengodsgames.com/",
    accent: "violet",
  },
  {
    id: "farm-assets",
    label: "FARM 77 Inventory",
    kind: "GAME",
    status: "LOGIN",
    description: "OTOMO、種、作物、進化素材、畑と奉納ミッション。",
    href: "https://otomofarm.sevengodsgames.com/",
    accent: "green",
  },
  {
    id: "canon-catalog",
    label: "SGG Character Catalog",
    kind: "CATALOG",
    status: "AVAILABLE",
    description: "7 GODS × 7 OTOMOと三形態の公式対応を確認。",
    href: null,
    accent: "cyan",
  },
] as const;

export type LedgerSystem = {
  id: string;
  label: string;
  category: "RESULT" | "POINT" | "RESOURCE" | "REWARD" | "TOKEN" | "COMMUNITY";
  status: "AVAILABLE" | "AUTH_REQUIRED" | "AUDIT" | "PLANNED";
  description: string;
  source: string;
  accent: Accent;
};

export const ledgerSystems: readonly LedgerSystem[] = [
  {
    id: "raw-score",
    label: "RAW GAMEPLAY SCORE",
    category: "RESULT",
    status: "AVAILABLE",
    description: "ゲームルールだけで確定する生結果。Walletや保有資産は影響しません。",
    source: "各ゲームの公式結果",
    accent: "cyan",
  },
  {
    id: "ranking",
    label: "RANKING",
    category: "RESULT",
    status: "AVAILABLE",
    description: "生結果から確定する順位。ポイントとは別の記録です。",
    source: "PUBLIC RANKING API / PAGE",
    accent: "violet",
  },
  {
    id: "sgg-game-points",
    label: "SGG_GAME_POINTS",
    category: "POINT",
    status: "AUDIT",
    description: "結果確定後に別計算する活動ポイント。Questはpolicy監査が残っています。",
    source: "GAME POINT LEDGER",
    accent: "gold",
  },
  {
    id: "game-resources",
    label: "GAME RESOURCES",
    category: "RESOURCE",
    status: "AUTH_REQUIRED",
    description: "GOLD、素材、作物などゲーム固有の資源。ゲーム間で合算しません。",
    source: "QUEST / FARM",
    accent: "green",
  },
  {
    id: "reward-candidates",
    label: "REWARD CANDIDATE",
    category: "REWARD",
    status: "AUTH_REQUIRED",
    description: "審査・確定・配布を別管理する候補。ポイント獲得は配布確約ではありません。",
    source: "SEASON SETTLEMENT",
    accent: "coral",
  },
  {
    id: "sdt",
    label: "SDT / COMMUNITY SCORE",
    category: "COMMUNITY",
    status: "AUTH_REQUIRED",
    description: "SEVENDAOの学び・参加・貢献指標。SGG_GAME_POINTSとは別制度です。",
    source: "SEVENDAO",
    accent: "violet",
  },
  {
    id: "sgg-token",
    label: "SGG Token",
    category: "TOKEN",
    status: "PLANNED",
    description: "chain、contract、供給量、公開日は未確定。残高表示や価格表示は行いません。",
    source: "SGG ROADMAP PHASE 3",
    accent: "gold",
  },
] as const;

export type CommunityItem = {
  id: string;
  channel: "X" | "DISCORD" | "SUBSTACK" | "SEVENDAO" | "SYSTEM";
  status: "PUBLISHED" | "PREPARING" | "MVP_DEMO";
  title: string;
  description: string;
  dateLabel: string;
  href: string | null;
  actionLabel: string;
  accent: Accent;
};

export const communityItems: readonly CommunityItem[] = [
  {
    id: "x-ai-ip-memory",
    channel: "X",
    status: "PUBLISHED",
    title: "AI can multiply concepts; memory creates identity",
    description: "SEVENGODS Games公式Xで公開された、AIとIPの記憶についてのフィールドノート。",
    dateLabel: "2026.07.14 · 07:40 MYT",
    href: "https://x.com/SEVENGODSGAMES/status/2076814006426493269",
    actionLabel: "投稿を見る",
    accent: "cyan",
  },
  {
    id: "x-ip-differentiator",
    channel: "X",
    status: "PUBLISHED",
    title: "ゲーム制作の差はIP",
    description: "小さく速く作れる時代に、記憶に残るIPが差になるというSGGの視点。",
    dateLabel: "2026.07.13 · 09:32 JST",
    href: "https://x.com/SEVENGODSGAMES/status/2076464673655070868",
    actionLabel: "投稿を見る",
    accent: "gold",
  },
  {
    id: "discord-community",
    channel: "DISCORD",
    status: "PREPARING",
    title: "SGG Discord Community",
    description: "告知、ゲーム別チャンネル、イベント参加、質問とフィードバックの中心。",
    dateLabel: "PUBLIC INVITE PREPARING",
    href: null,
    actionLabel: "公開導線を準備中",
    accent: "violet",
  },
  {
    id: "substack-dispatch",
    channel: "SUBSTACK",
    status: "PREPARING",
    title: "SEVENGODS Games Dispatch",
    description: "背景、開発思想、先行情報を保存して読める公式ロングフォーム。",
    dateLabel: "FOLLOW FOR UPDATES",
    href: null,
    actionLabel: "公開準備中",
    accent: "coral",
  },
  {
    id: "sevendao-learning",
    channel: "SEVENDAO",
    status: "MVP_DEMO",
    title: "学び・授業・貢献",
    description: "学び・授業・チェックインを体験できるMVP／DEMO。表示値はSGG Player OSへ統合しません。",
    dateLabel: "COMMUNITY LEARNING",
    href: "https://app.seven-terakoya.com/",
    actionLabel: "SEVENDAO Appへ",
    accent: "green",
  },
] as const;

export const systemNotifications = [
  {
    id: "notice-live-games",
    kind: "PLAY",
    title: "4タイトルの公開状態を確認しました",
    detail: "ORACLE / QUEST / FARM / TAIYO",
    target: "games" as const,
  },
  {
    id: "notice-ranking",
    kind: "ARENA",
    title: "公開ランキングをライブ同期できます",
    detail: "Oracle・Questのpublic API",
    target: "arena" as const,
  },
  {
    id: "notice-identity",
    kind: "MY SGG",
    title: "個人データの統合にはDiscord連携が必要です",
    detail: "Walletは任意です",
    target: "mysgg" as const,
  },
] as const;

export const releaseStateLabels: Record<ReleaseState, string> = {
  LIVE: "プレイ可能",
  DRAFT: "開発中",
  NOT_DEPLOYED: "未公開",
};

export const releaseStateCounts = games.reduce(
  (counts, game) => {
    counts[game.releaseState] += 1;
    return counts;
  },
  { LIVE: 0, DRAFT: 0, NOT_DEPLOYED: 0 } as Record<ReleaseState, number>,
);
