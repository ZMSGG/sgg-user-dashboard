export type Accent = "cyan" | "violet" | "coral" | "gold" | "green";

export type ReleaseState = "LIVE" | "MAINTENANCE" | "DORMANT" | "DRAFT" | "NOT_DEPLOYED";
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
  /** Approved key art. Null keeps a dormant title visually quiet. */
  keyArt: string | null;
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
    releaseState: "DORMANT",
    releaseLabel: "休眠中 · 市場投入対象外",
    sourceLabel: "DEPLOYMENT REGISTRY · 2026.07.20",
    syncMode: "AUTH_REQUIRED",
    accent: "violet",
    glyph: "Q7",
    genre: "LONG-FORM EXPEDITION",
    duration: "77",
    keyArt: "/dashboard-art/games/quest.png",
    officialUrl: "https://otomoquest.sevengodsgames.com/",
    rankingUrl: "https://otomoquest.sevengodsgames.com/ranking",
    guideUrl: "https://otomoquest.sevengodsgames.com/guide",
    primaryAction: "QUESTを開く",
    nextAction: "帰還・派遣状況を確認",
    nextActionMeta: "Discordログイン後にゲーム側で同期",
  },
  {
    id: "otomo-chain-7",
    title: "OTOMO CHAIN 7",
    shortTitle: "CHAIN 7",
    subtitle: "7つで神連鎖。爽快なぞり消しパズル",
    description:
      "同じOTOMOをなぞって消すタイムアタックパズル。ただし狙いは『ちょうど7個』——PERFECT 7で777点、3回決めればGOD RUSH。ルールが毎日変わる7日間、番付に残るのは今日のベスト1走だけ。",
    releaseState: "LIVE",
    releaseLabel: "配信中 · 重点タイトル",
    sourceLabel: "PRODUCTION API · /api/season",
    syncMode: "PUBLIC",
    accent: "cyan",
    glyph: "C7",
    genre: "SHORT-RUN RANKING",
    duration: "7",
    // OTOMO3体が縁側で行灯画面のCHAINをプレイする公式サムネ (2026-07-31生成)。
    keyArt: "/dashboard-art/games/chain.png",
    officialUrl: "https://otomochain.sevengodsgames.com/",
    rankingUrl: "https://otomochain.sevengodsgames.com/",
    guideUrl: null,
    primaryAction: "CHAINをプレイする",
    nextAction: "シーズンの開催状況を確認",
    nextActionMeta: "第1回大会は終了。次回の日程は公式発表で",
    featured: true,
  },
  {
    id: "otomo-farm-77",
    title: "OTOMO FARM 77",
    shortTitle: "FARM 77",
    subtitle: "毎日3分で神域を耕す。ほのぼの農園番付",
    description:
      "相棒OTOMOを卵から満願Lv.77まで育てる77日の農園シーズン。加護予報を読んで種をまき、寝ている間に実らせる。課金や保有のブーストは一切なし——収穫も番付も、毎日の3分を積んだ者だけが強い完全平等の畑。",
    releaseState: "MAINTENANCE",
    releaseLabel: "工事中 · 重点タイトル",
    sourceLabel: "DEPLOYMENT REGISTRY · 2026.07.20",
    syncMode: "AUTH_REQUIRED",
    accent: "green",
    glyph: "F7",
    genre: "LONG-FORM FARMING",
    duration: "77",
    // 鶴のハク・寿鹿・鯛丸が棚田で農作業する公式サムネ (2026-07-31生成)。
    keyArt: "/dashboard-art/games/farm.png",
    officialUrl: "https://otomo-farm-77.vercel.app/",
    rankingUrl: "https://otomo-farm-77.vercel.app/rankings",
    guideUrl: null,
    primaryAction: "FARMを開く",
    nextAction: "工事完了までお待ちください",
    nextActionMeta: "再開は公式発表でお知らせ",
  },
  {
    id: "otomo-oracle-7",
    title: "OTOMO ORACLE 7",
    shortTitle: "ORACLE 7",
    subtitle: "七柱の神託を読み解く",
    description:
      "7体のOTOMOを神座へ配置する、1日1問の空間ロジックゲーム。練習と神託番付を公開中。",
    releaseState: "DORMANT",
    releaseLabel: "休眠中 · 市場投入対象外",
    sourceLabel: "HTTP 200 VERIFIED · 2026.07.14",
    syncMode: "PUBLIC",
    accent: "cyan",
    glyph: "O7",
    genre: "DAILY LOGIC",
    duration: "7",
    keyArt: "/dashboard-art/games/oracle.png",
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
    releaseState: "DORMANT",
    releaseLabel: "休眠中 · 市場投入対象外",
    sourceLabel: "DEPLOYMENT REGISTRY · 2026.07.20",
    syncMode: "UNAVAILABLE",
    accent: "gold",
    glyph: "大",
    genre: "ACTION RPG",
    duration: "ACTION",
    keyArt: "/dashboard-art/games/taiyo.png",
    officialUrl: null,
    rankingUrl: null,
    guideUrl: null,
    primaryAction: "この端末でウォッチ",
    nextAction: "公開レビュー待ち",
    nextActionMeta: "公開日未確定 · 現在は非公開",
  },
  {
    id: "ebisu-fishing-77",
    title: "EBISU FISHING 77",
    shortTitle: "FISHING 77",
    subtitle: "潮を読み、仕掛けを最適化する",
    description:
      "11の潮を77時間で巡る放置釣りゲーム。仕様・進行・データ設計を準備中。",
    releaseState: "DORMANT",
    releaseLabel: "休眠中 · 市場投入対象外",
    sourceLabel: "PROJECT REGISTRY · 2026.07.14",
    syncMode: "UNAVAILABLE",
    accent: "coral",
    glyph: "釣",
    genre: "IDLE FISHING",
    duration: "77",
    keyArt: "/dashboard-art/games/ebisu.png",
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

/**
 * SGGでの軌跡 — the permanent record of finished tournaments.
 *
 * Every row is a confirmed result read from the game's own locked public
 * leaderboard after season end; nothing here is projected or provisional.
 * CHAIN and FARM tournaments are meant to recur, so the shape assumes many
 * editions per game: the passport view filters by game, searches by name,
 * and pages five records at a time as this list grows.
 */
export type TournamentRecord = {
  id: string;
  gameId: string;
  /** Display title of the game, matching GameSummary.title. */
  game: string;
  /** e.g. 第1回大会 — the recurring-edition label players search by. */
  edition: string;
  name: string;
  seasonId: string;
  startAt: string;
  endAt: string;
  participants: number;
  podium: readonly { rank: number; name: string; godName: string; score: number }[];
  /** 陣営 (team) result, when the tournament had one. */
  teamChampion: string | null;
  /** Total SGP awarded across all finishers, as decided in the award table. */
  prizeSgpTotal: number | null;
  resultUrl: string | null;
  /** Where the numbers come from — shown verbatim on the card. */
  provenance: string;
  accent: Accent;
};

export const tournamentRecords: readonly TournamentRecord[] = [
  {
    id: "chain-7-tournament-1",
    gameId: "otomo-chain-7",
    game: "OTOMO CHAIN 7",
    edition: "第1回大会",
    name: "OTOMO CHAIN 7 第1回大会",
    seasonId: "season-2026-08-01",
    startAt: "2026-08-01T00:00:00.000Z",
    endAt: "2026-08-08T00:00:00.000Z",
    participants: 52,
    podium: [
      { rank: 1, name: "しるばー", godName: "寿楽", score: 911_367 },
      { rank: 2, name: "ちゃろ", godName: "蒼毘", score: 472_396 },
      { rank: 3, name: "toto_kichi", godName: "蒼毘", score: 415_628 },
    ],
    teamChampion: "大耀陣営",
    prizeSgpTotal: 1_129,
    resultUrl: "https://otomochain.sevengodsgames.com/",
    provenance: "確定番付はゲーム公開API (leaderboard/season, ロック済み) をそのまま記載。",
    accent: "cyan",
  },
] as const;

export type OfficialLink = {
  group: "CHANNEL" | "MARKET";
  label: string;
  /** Shown under the label; the destination in the reader's words. */
  meta: string;
  href: string;
};

/**
 * Every outbound official destination, in one place. The コミュニティ view
 * renders these and the home card counts them, so a link added here appears
 * in both without the count drifting away from the list.
 */
export const officialLinks: readonly OfficialLink[] = [
  { group: "CHANNEL", label: "SGG LP", meta: "sevengodsgames.com", href: "https://sevengodsgames.com/" },
  { group: "CHANNEL", label: "SG LP", meta: "seven-gods.com", href: "https://seven-gods.com/" },
  { group: "CHANNEL", label: "X", meta: "@SEVENGODSGAMES", href: "https://x.com/SEVENGODSGAMES" },
  { group: "CHANNEL", label: "Discord", meta: "招待リンク", href: "https://discord.gg/3ByquYMHUp" },
  // SEVENDAOapp was listed as 準備中 while it was already serving; it is live.
  { group: "CHANNEL", label: "SEVENDAOapp", meta: "app.seven-terakoya.com", href: "https://app.seven-terakoya.com/" },
  { group: "MARKET", label: "SEVENGODS", meta: "OpenSea", href: "https://opensea.io/ja/collection/seven-gods?activityTypes=sale" },
  { group: "MARKET", label: "OTOMO 童子", meta: "OpenSea", href: "https://opensea.io/ja/collection/otomo-douji" },
  { group: "MARKET", label: "OTOMO 受肉体", meta: "OpenSea", href: "https://opensea.io/ja/collection/otomo-junikutai" },
  { group: "MARKET", label: "OTOMO 精霊体", meta: "OpenSea", href: "https://opensea.io/ja/collection/otomo-seireitai" },
  { group: "MARKET", label: "SDT", meta: "SCENT DEX", href: "https://dex.scenttoken.com/trade" },
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
  { godId: "SAIKA", godName: "才華", otomoId: "KOTONE", otomoName: "琴音", glyph: "琴", accent: "violet" },
  { godId: "JURAKU", godName: "寿楽", otomoId: "JUKA", otomoName: "寿鹿", glyph: "寿", accent: "green" },
  { godId: "FUKUEI", godName: "福永", otomoId: "HAKU", otomoName: "ハク", glyph: "白", accent: "cyan" },
  { godId: "SHOUREN", godName: "笑蓮", otomoId: "SHOFUKU", otomoName: "笑袋", glyph: "笑", accent: "gold" },
] as const;

export const otomoForms = [
  { code: "SPIRIT", label: "精霊体", description: "相棒との出会い・探索の入口", accent: "cyan" as Accent },
  { code: "INCARNATE", label: "受肉体", description: "成長・制作・中盤の深化", accent: "coral" as Accent },
  { code: "DOJI", label: "童子", description: "成熟・戦略・コレクション", accent: "violet" as Accent },
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
    label: "SDT / SEVENDAO TOKEN",
    category: "COMMUNITY",
    status: "AVAILABLE",
    description: "連携WalletのSDT保有数を表示中（表示のみ・価格なし）。コミュニティ指標は実装予定です。",
    source: "ETHEREUM MAINNET",
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
  channel: "X" | "DISCORD" | "SEVENDAO" | "SYSTEM";
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
    title: "4タイトルの公開URLをカタログ化しました",
    detail: "稼働状態はlive healthで確認",
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
  // Deployed and being taken to market, but currently closed for rework.
  // Play links are withheld until the construction ends.
  MAINTENANCE: "工事中",
  // Built and reachable, but not part of the titles currently being taken to
  // market. Deliberately distinct from 開発中 and 未公開.
  DORMANT: "休眠中",
  DRAFT: "開発中",
  NOT_DEPLOYED: "未公開",
};

export const releaseStateCounts = games.reduce(
  (counts, game) => {
    counts[game.releaseState] += 1;
    return counts;
  },
  { LIVE: 0, MAINTENANCE: 0, DORMANT: 0, DRAFT: 0, NOT_DEPLOYED: 0 } as Record<ReleaseState, number>,
);
