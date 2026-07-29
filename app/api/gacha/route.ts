import { grantRequestFingerprint, hasJsonRequestHeader, jsonError, readSession } from "../../../server/auth";
import {
  cardById,
  cryptoRandom,
  GACHA_CARDS,
  GACHA_COST,
  GACHA_POOL_ID,
  pickCard,
} from "../../../server/gacha";
import {
  appendGachaDraw,
  getCurrencyBalances,
  getGachaInventory,
  getGachaPullByIdempotencyKey,
  getPlayer,
  getDb,
  isInsufficientCurrencyBalanceError,
  isUniqueConstraintError,
} from "../../../server/passport-db";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

/** Pool definition and the signed-in player's cards. Read-only. */
export async function GET(request: Request) {
  const db = await getDb();
  const session = await readSession(request);
  if (!db || !session) return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");

  const [inventory, balances] = await Promise.all([
    getGachaInventory(db, session.sub),
    getCurrencyBalances(db, session.sub),
  ]);
  const counts = Object.fromEntries(inventory.map((row) => [row.cardId, row.count]));

  return Response.json({
    poolId: GACHA_POOL_ID,
    cost: GACHA_COST,
    balance: balances[GACHA_COST.currency] ?? 0,
    cards: GACHA_CARDS.map((card) => ({
      id: card.id,
      pairId: card.pairId,
      godName: card.godName,
      otomoName: card.otomoName,
      form: card.form,
      formLabel: card.formLabel,
      rarity: card.rarity,
      art: card.art,
      accent: card.accent,
      owned: counts[card.id] ?? 0,
    })),
  }, { headers: NO_STORE });
}

/**
 * One draw. The client supplies the idempotency key so a network retry
 * resolves to the identical card instead of a second charge.
 */
export async function POST(request: Request) {
  if (!hasJsonRequestHeader(request)) {
    return jsonError(403, "BAD_REQUEST_HEADER", "不正なリクエストです。");
  }
  const db = await getDb();
  const session = await readSession(request);
  if (!db || !session) return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");

  const player = await getPlayer(db, session.sub);
  if (!player) return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");

  let body: { idempotencyKey?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return jsonError(400, "BAD_JSON", "リクエスト本文を読み取れません。");
  }
  if (typeof body.idempotencyKey !== "string" || !IDEMPOTENCY_PATTERN.test(body.idempotencyKey)) {
    return jsonError(400, "BAD_IDEMPOTENCY_KEY", "冪等キーが不正です。");
  }
  const idempotencyKey = `gacha:${session.sub}:${body.idempotencyKey}`;

  // A completed draw under this key returns its original card, charge-free.
  const existing = await getGachaPullByIdempotencyKey(db, idempotencyKey);
  if (existing) {
    const card = cardById(existing.cardId);
    const balances = await getCurrencyBalances(db, session.sub);
    return Response.json({
      ok: true,
      alreadyDrawn: true,
      card,
      balance: balances[GACHA_COST.currency] ?? 0,
    }, { headers: NO_STORE });
  }

  const balances = await getCurrencyBalances(db, session.sub);
  const balance = balances[GACHA_COST.currency] ?? 0;
  if (balance < GACHA_COST.amount) {
    return jsonError(402, "INSUFFICIENT_FUNDS", `勾玉が足りません（必要: ${GACHA_COST.amount}、保有: ${balance}）。`);
  }

  const card = pickCard(cryptoRandom());
  const requestFingerprint = await grantRequestFingerprint({
    actor: session.sub,
    discordId: session.sub,
    amount: -GACHA_COST.amount,
    currency: GACHA_COST.currency,
    reasonCode: "GACHA_DRAW",
    note: card.id,
  });

  try {
    await appendGachaDraw(db, {
      discordId: session.sub,
      amount: GACHA_COST.amount,
      currency: GACHA_COST.currency,
      poolId: GACHA_POOL_ID,
      cardId: card.id,
      rarity: card.rarity,
      idempotencyKey,
      requestFingerprint,
    });
  } catch (error) {
    if (isInsufficientCurrencyBalanceError(error)) {
      return jsonError(402, "INSUFFICIENT_FUNDS", "勾玉が足りません。残高を更新して再度お試しください。");
    }
    if (!isUniqueConstraintError(error)) throw error;
    // Lost a race against our own retry: surface the recorded result.
    const recorded = await getGachaPullByIdempotencyKey(db, idempotencyKey);
    if (!recorded) throw error;
    const after = await getCurrencyBalances(db, session.sub);
    return Response.json({
      ok: true,
      alreadyDrawn: true,
      card: cardById(recorded.cardId),
      balance: after[GACHA_COST.currency] ?? 0,
    }, { headers: NO_STORE });
  }

  const after = await getCurrencyBalances(db, session.sub);
  return Response.json({
    ok: true,
    alreadyDrawn: false,
    card,
    balance: after[GACHA_COST.currency] ?? 0,
  }, { headers: NO_STORE });
}
