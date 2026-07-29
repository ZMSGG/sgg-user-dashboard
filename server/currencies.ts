/**
 * Dashboard currency registry.
 *
 * One append-only ledger (point_grants) carries every currency; this registry
 * is the closed vocabulary of what `currency` may contain. These are
 * dashboard-native soft currencies created on owner instruction (2026-07-29).
 * None of them is a token, none has a price, and none may be presented as
 * exchangeable value — the SGG Token boundary in the architecture doc applies
 * to all of them.
 */

export type CurrencyCode = "SGP" | "MAGATAMA" | "FUKUSEN";

export type CurrencyDef = {
  code: CurrencyCode;
  /** Display name shown to players. */
  label: string;
  /** Short glyph for chips and compact rows. */
  glyph: string;
  accent: "gold" | "violet" | "coral";
  description: string;
};

export const CURRENCIES: readonly CurrencyDef[] = [
  {
    code: "SGP",
    label: "SGGポイント",
    glyph: "◈",
    accent: "gold",
    description: "参加と貢献の記録。管理者と承認済み連携だけが付与できます。",
  },
  {
    code: "MAGATAMA",
    label: "勾玉",
    glyph: "☽",
    accent: "violet",
    description: "図鑑ガチャを引くための石。イベントや大会の参加で授与されます。",
  },
  {
    code: "FUKUSEN",
    label: "福銭",
    glyph: "✦",
    accent: "coral",
    description: "催事用の縁起銭。将来のイベント企画のために予約されています。",
  },
] as const;

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCY_CODES as string[]).includes(value);
}
