/**
 * 図鑑ガチャ (collection-card gacha).
 *
 * Draws award dashboard-native collection cards of the canonical 7 GODS × 7
 * OTOMO pairs in their three forms. Cards are cosmetic records in this
 * dashboard only: they are not NFTs, not game items, and confer no gameplay
 * or ranking advantage. Rates and cost are DRAFT project-only assumptions
 * recorded in DECISIONS.md, not canon.
 *
 * A draw is one debit (negative MAGATAMA grant) plus one pull row under the
 * same idempotency key, so a retry can neither double-charge nor double-award.
 */

import type { CurrencyCode } from "./currencies";

export type GachaRarity = "N" | "R" | "SR";

export type GachaCard = {
  id: string;
  pairId: string;
  godName: string;
  otomoName: string;
  /** Canonical OTOMO form the card depicts. */
  form: "SPIRIT" | "INCARNATE" | "DOJI";
  formLabel: string;
  rarity: GachaRarity;
  /** Bespoke Image 2.0 card face (batch-01); raw canon art is prohibited in runtime. */
  art: string;
  accent: string;
  weight: number;
};

export const GACHA_POOL_ID = "canon-catalog-v1";
export const GACHA_COST: { currency: CurrencyCode; amount: number } = {
  currency: "MAGATAMA",
  amount: 7,
};

/** DRAFT rates: N 100 / R 35 / SR 10 per card (7 cards per tier). */
const FORM_META = [
  { form: "SPIRIT", formLabel: "精霊体", rarity: "N", weight: 100 },
  { form: "INCARNATE", formLabel: "受肉体", rarity: "R", weight: 35 },
  { form: "DOJI", formLabel: "童子", rarity: "SR", weight: 10 },
] as const;

const PAIRS = [
  { pairId: "ebisu-taimaru", godName: "恵比寿", otomoName: "鯛丸", slug: "taimaru", accent: "coral" },
  { pairId: "taiyo-kozuchi", godName: "大耀", otomoName: "小槌", slug: "kozuchi", accent: "gold" },
  { pairId: "sobi-momokatsu", godName: "蒼毘", otomoName: "百勝", slug: "momokatsu", accent: "cyan" },
  { pairId: "saika-kotone", godName: "彩華", otomoName: "琴音", slug: "kotone", accent: "violet" },
  { pairId: "juraku-juka", godName: "寿楽", otomoName: "寿鹿", slug: "juka", accent: "green" },
  { pairId: "fukuei-haku", godName: "福栄", otomoName: "ハク", slug: "haku", accent: "cyan" },
  { pairId: "shouren-shofuku", godName: "笑蓮", otomoName: "笑袋", slug: "shofuku", accent: "gold" },
] as const;

export const GACHA_CARDS: readonly GachaCard[] = PAIRS.flatMap((pair) =>
  FORM_META.map((meta) => ({
    id: `${pair.pairId}-${meta.form.toLowerCase()}`,
    pairId: pair.pairId,
    godName: pair.godName,
    otomoName: pair.otomoName,
    form: meta.form,
    formLabel: meta.formLabel,
    rarity: meta.rarity,
    art: `/dashboard-art/cards/faces/${pair.slug}-${meta.form.toLowerCase()}.png`,
    accent: pair.accent,
    weight: meta.weight,
  })),
);

export const GACHA_TOTAL_WEIGHT = GACHA_CARDS.reduce((sum, card) => sum + card.weight, 0);

export function cardById(cardId: string): GachaCard | null {
  return GACHA_CARDS.find((card) => card.id === cardId) ?? null;
}

/**
 * Picks a card from a uniform random value in [0, 1). Injectable randomness
 * keeps the distribution testable; the route feeds it crypto randomness.
 */
export function pickCard(random: number): GachaCard {
  if (!Number.isFinite(random) || random < 0 || random >= 1) {
    throw new Error("gacha random input must be in [0, 1)");
  }
  let remaining = Math.floor(random * GACHA_TOTAL_WEIGHT);
  for (const card of GACHA_CARDS) {
    remaining -= card.weight;
    if (remaining < 0) return card;
  }
  // Unreachable: weights cover the whole range.
  return GACHA_CARDS[GACHA_CARDS.length - 1];
}

export function cryptoRandom(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
}
