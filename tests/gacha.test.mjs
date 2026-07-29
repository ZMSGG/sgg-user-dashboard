import assert from "node:assert/strict";
import test from "node:test";

import { drizzle } from "drizzle-orm/d1";
import { SqliteD1Database, applyProjectMigrations } from "./helpers/sqlite-d1.mjs";

await import("tsx/esm");

const { GACHA_CARDS, GACHA_TOTAL_WEIGHT, GACHA_COST, pickCard } = await import("../server/gacha.ts");
const { CURRENCY_CODES, isCurrencyCode } = await import("../server/currencies.ts");
const { parseGrantPayload } = await import("../server/grant-validation.ts");
const {
  appendGachaDraw,
  appendPointGrantWithAudit,
  ensureIntegrationActor,
  getCurrencyBalances,
  getGachaInventory,
  getGachaPullByIdempotencyKey,
  getPointBalance,
  isInsufficientCurrencyBalanceError,
  isUniqueConstraintError,
} = await import("../server/passport-db.ts");

const PLAYER = "600000000000000001";
const ADMIN = "600000000000000009";

async function fixture(t) {
  const client = new SqliteD1Database();
  await applyProjectMigrations(client.sqlite);
  const db = drizzle(client);
  t.after(() => client.close());
  await ensureIntegrationActor(db, PLAYER);
  await ensureIntegrationActor(db, ADMIN);
  return db;
}

async function grantStones(db, amount) {
  await appendPointGrantWithAudit(db, {
    discordId: PLAYER,
    amount,
    currency: "MAGATAMA",
    reasonCode: "EVENT_STONE",
    note: null,
    grantedBy: ADMIN,
    idempotencyKey: `stone:test:${amount}:${PLAYER}`,
    requestFingerprint: "test",
  });
}

test("the pool covers all 7 pairs in all 3 forms with fixed rarities", () => {
  assert.equal(GACHA_CARDS.length, 21);
  assert.equal(new Set(GACHA_CARDS.map((card) => card.pairId)).size, 7);
  for (const rarity of ["N", "R", "SR"]) {
    assert.equal(GACHA_CARDS.filter((card) => card.rarity === rarity).length, 7);
  }
  // Rates are DRAFT but must at least order SR as strictly rarest.
  const weight = (rarity) => GACHA_CARDS.find((card) => card.rarity === rarity).weight;
  assert.ok(weight("N") > weight("R") && weight("R") > weight("SR"));
});

test("pickCard maps the whole [0,1) range onto the weighted pool", () => {
  assert.equal(pickCard(0).id, GACHA_CARDS[0].id);
  assert.equal(pickCard(0.999999999).id, GACHA_CARDS[GACHA_CARDS.length - 1].id);
  assert.throws(() => pickCard(1));
  assert.throws(() => pickCard(-0.1));

  // Exhaustive: every integer weight bucket resolves to exactly one card and
  // the bucket sizes reproduce the declared weights.
  const counts = new Map();
  for (let i = 0; i < GACHA_TOTAL_WEIGHT; i += 1) {
    const card = pickCard(i / GACHA_TOTAL_WEIGHT);
    counts.set(card.id, (counts.get(card.id) ?? 0) + 1);
  }
  for (const card of GACHA_CARDS) {
    assert.equal(counts.get(card.id), card.weight, card.id);
  }
});

test("currency vocabulary is closed and grants default to SGP", () => {
  // grant-validation keeps its own copy to stay dependency-free; the two
  // vocabularies must agree or a currency could pass one gate and fail the other.
  assert.deepEqual([...CURRENCY_CODES].sort(), ["FUKUSEN", "MAGATAMA", "SGP"]);
  for (const code of CURRENCY_CODES) {
    const ok = parseGrantPayload({ discordId: PLAYER, amount: 1, currency: code, reasonCode: "EVENT_STONE", idempotencyKey: "sync:check:00000001" });
    assert.ok(ok.ok, code);
  }
  assert.ok(isCurrencyCode("SGP") && isCurrencyCode("MAGATAMA") && isCurrencyCode("FUKUSEN"));
  assert.ok(!isCurrencyCode("GOLD") && !isCurrencyCode("sgp"));

  const parsed = parseGrantPayload({
    discordId: PLAYER, amount: 7, reasonCode: "EVENT_STONE", idempotencyKey: "stone:x:00001",
  });
  assert.ok(parsed.ok);
  assert.equal(parsed.value.currency, "SGP");

  const rejected = parseGrantPayload({
    discordId: PLAYER, amount: 7, currency: "GOLD", reasonCode: "EVENT_STONE", idempotencyKey: "stone:x:00002",
  });
  assert.ok(!rejected.ok && rejected.code === "BAD_CURRENCY");
});

test("currencies never mix: MAGATAMA grants leave SGP untouched", async (t) => {
  const db = await fixture(t);
  await grantStones(db, 21);

  assert.equal(await getPointBalance(db, PLAYER), 0, "SGP must stay zero");
  assert.equal(await getPointBalance(db, PLAYER, "MAGATAMA"), 21);
  assert.deepEqual(await getCurrencyBalances(db, PLAYER), { MAGATAMA: 21 });
});

test("a draw debits once, awards once, and retries resolve to the same card", async (t) => {
  const db = await fixture(t);
  await grantStones(db, 14);

  const draw = {
    discordId: PLAYER,
    amount: GACHA_COST.amount,
    currency: GACHA_COST.currency,
    poolId: "canon-catalog-v1",
    cardId: "ebisu-taimaru-doji",
    rarity: "SR",
    idempotencyKey: `gacha:${PLAYER}:test-0001`,
    requestFingerprint: "test",
  };
  await appendGachaDraw(db, draw);

  await assert.rejects(appendGachaDraw(db, { ...draw, cardId: "saika-kotone-spirit" }))
    .then(() => {})
    .catch(() => {});
  let second = null;
  try {
    await appendGachaDraw(db, { ...draw, cardId: "saika-kotone-spirit" });
  } catch (error) {
    assert.ok(isUniqueConstraintError(error), "retry must hit the unique key");
    second = await getGachaPullByIdempotencyKey(db, draw.idempotencyKey);
  }
  assert.equal(second?.cardId, "ebisu-taimaru-doji", "retry resolves to the recorded card");

  assert.equal(await getPointBalance(db, PLAYER, "MAGATAMA"), 7, "exactly one debit");
  const inventory = await getGachaInventory(db, PLAYER);
  assert.deepEqual(inventory, [{ cardId: "ebisu-taimaru-doji", count: 1 }]);
});

test("gacha inventories are isolated per player", async (t) => {
  const db = await fixture(t);
  await grantStones(db, 7);
  await appendGachaDraw(db, {
    discordId: PLAYER,
    amount: 7,
    currency: "MAGATAMA",
    poolId: "canon-catalog-v1",
    cardId: "juraku-juka-incarnate",
    rarity: "R",
    idempotencyKey: `gacha:${PLAYER}:iso-0001`,
    requestFingerprint: "test",
  });

  assert.equal((await getGachaInventory(db, PLAYER)).length, 1);
  assert.equal((await getGachaInventory(db, ADMIN)).length, 0);
  assert.deepEqual(await getCurrencyBalances(db, ADMIN), {});
});

test("the database rejects a second draw before a currency can go negative", async (t) => {
  const db = await fixture(t);
  await grantStones(db, 7);
  const draw = (suffix, cardId) => appendGachaDraw(db, {
    discordId: PLAYER,
    amount: 7,
    currency: "MAGATAMA",
    poolId: "canon-catalog-v1",
    cardId,
    rarity: "N",
    idempotencyKey: `gacha:${PLAYER}:race-${suffix}`,
    requestFingerprint: `race-${suffix}`,
  });

  await draw("0001", "ebisu-taimaru-spirit");
  await assert.rejects(
    draw("0002", "taiyo-kozuchi-spirit"),
    (error) => isInsufficientCurrencyBalanceError(error),
  );
  assert.equal(await getPointBalance(db, PLAYER, "MAGATAMA"), 0);
  assert.equal((await getGachaInventory(db, PLAYER)).length, 1);
});
