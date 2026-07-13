export type TournamentRecord = {
  id: string;
  game: string;
  tournament: string;
  date: string;
  result: string;
  rank: string;
  rawLabel: string;
  rawValue: string;
  points: number;
  accent: "cyan" | "violet" | "orange" | "pink";
};

export type PointLedgerItem = {
  id: string;
  title: string;
  detail: string;
  date: string;
  amount: number;
  source: "GAME" | "COMMUNITY";
  status: "確定" | "確認中";
};

export const tournamentRecords: TournamentRecord[] = [
  {
    id: "tr-001",
    game: "OTOMO CASCADE 7",
    tournament: "SUMMER CIRCUIT #03",
    date: "2026.07.06",
    result: "優勝",
    rank: "1 / 248",
    rawLabel: "RAW SCORE",
    rawValue: "98,420",
    points: 1400,
    accent: "cyan",
  },
  {
    id: "tr-002",
    game: "GODS AUCTION 7",
    tournament: "WEEKEND CUP #11",
    date: "2026.06.28",
    result: "BEST 8",
    rank: "8 / 192",
    rawLabel: "RAW SCORE",
    rawValue: "7,640",
    points: 520,
    accent: "orange",
  },
  {
    id: "tr-003",
    game: "OTOMO ORACLE 7",
    tournament: "ORACLE OPEN #07",
    date: "2026.06.21",
    result: "準優勝",
    rank: "2 / 317",
    rawLabel: "CLEAR TIME",
    rawValue: "06:42",
    points: 960,
    accent: "violet",
  },
  {
    id: "tr-004",
    game: "OTOMO CASCADE 7",
    tournament: "SUMMER CIRCUIT #02",
    date: "2026.06.14",
    result: "17位",
    rank: "17 / 236",
    rawLabel: "RAW SCORE",
    rawValue: "77,210",
    points: 320,
    accent: "pink",
  },
];

export const pointLedger: PointLedgerItem[] = [
  {
    id: "pt-001",
    title: "SUMMER CIRCUIT #03",
    detail: "大会結果・優勝",
    date: "2026.07.06 22:10",
    amount: 1400,
    source: "GAME",
    status: "確定",
  },
  {
    id: "pt-002",
    title: "コミュニティ貢献",
    detail: "Discordイベント運営サポート",
    date: "2026.07.04 18:32",
    amount: 200,
    source: "COMMUNITY",
    status: "確定",
  },
  {
    id: "pt-003",
    title: "WEEKEND CUP #11",
    detail: "大会結果・BEST 8",
    date: "2026.06.28 23:05",
    amount: 520,
    source: "GAME",
    status: "確定",
  },
  {
    id: "pt-004",
    title: "フィードバック協力",
    detail: "クローズドテスト回答",
    date: "2026.06.24 12:14",
    amount: 120,
    source: "COMMUNITY",
    status: "確認中",
  },
  {
    id: "pt-005",
    title: "ORACLE OPEN #07",
    detail: "大会結果・準優勝",
    date: "2026.06.21 21:47",
    amount: 960,
    source: "GAME",
    status: "確定",
  },
];

export const otomoForms = [
  { code: "SPIRIT", label: "精霊体", count: 5, tone: "cyan" },
  { code: "INCARNATE", label: "受肉体", count: 4, tone: "orange" },
  { code: "DOJI", label: "童子", count: 3, tone: "pink" },
] as const;
