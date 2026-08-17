import assert from "node:assert/strict";
import test from "node:test";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { SqliteD1Database, applyProjectMigrations } from "./helpers/sqlite-d1.mjs";

await import("tsx/esm");

const {
  appendPointGrantWithAudit,
  establishDiscordSession,
  ensureIntegrationActor,
  getPlayer,
  getPointBalance,
  getRecentGrants,
  getTournamentResults,
  grantRequestFingerprint,
  linkWalletWithAudit,
} = await import("../server/passport-db.ts");
const { createSessionArtifact, verifyPurposeToken } = await import("../server/auth.ts");
const { ensureGameLink, getGameLink, OTOMO_CHAIN_GAME_ID } = await import("../server/game-link.ts");

/**
 * Two-account isolation, the gate that must hold before any second person can
 * open this dashboard. Every assertion here is "player A cannot observe player
 * B", expressed against the same functions the routes call.
 */

const SECRET = "0123456789abcdef0123456789abcdef";
const ALICE = "400000000000000001";
const BOB = "400000000000000002";

async function fixture(t) {
  const client = new SqliteD1Database();
  await applyProjectMigrations(client.sqlite);
  const db = drizzle(client);
  t.after(() => client.close());

  for (const [discordId, username] of [[ALICE, "alice"], [BOB, "bob"]]) {
    await establishDiscordSession(
      db,
      { id: discordId, username, globalName: username, avatarHash: null },
      { id: `session-${discordId}`, expiresAt: Math.floor(Date.now() / 1000) + 3600 },
    );
  }
  await ensureIntegrationActor(db, "500000000000000001");
  return db;
}

async function grant(db, discordId, amount, key) {
  await appendPointGrantWithAudit(db, {
    discordId,
    amount,
    reasonCode: "TESTER_REWARD",
    note: null,
    grantedBy: "500000000000000001",
    idempotencyKey: key,
    requestFingerprint: await grantRequestFingerprint({
      actor: "500000000000000001", discordId, amount, reasonCode: "TESTER_REWARD", note: null,
    }),
  });
}

async function recordResult(db, discordId, rank, score, amount) {
  await db.run(sql`INSERT INTO tournament_results
    (tournament_id, season_id, discord_id, "rank", score, sgp_amount, breakdown)
    VALUES ('chain-7-tournament-1', 'season-2026-08-01', ${discordId}, ${rank}, ${score}, ${amount}, NULL)`);
}

test("tournament results and their SGP grant state never cross between players", async (t) => {
  const db = await fixture(t);
  await recordResult(db, ALICE, 1, 911_367, 226);
  await recordResult(db, BOB, 52, 777, 5);

  const alice = await getTournamentResults(db, ALICE);
  const bob = await getTournamentResults(db, BOB);
  assert.equal(alice.length, 1);
  assert.equal(bob.length, 1);
  assert.equal(alice[0].rank, 1);
  assert.equal(bob[0].rank, 52);

  // The result reads 付与予定 until the ledger actually carries the
  // distribution's idempotency key for this exact player...
  assert.equal(alice[0].grantedAt, null);
  await grant(db, ALICE, 226, `tournament:season-2026-08-01:${ALICE}`);
  assert.notEqual((await getTournamentResults(db, ALICE))[0].grantedAt, null);
  // ...and one player's grant never flips the other's state.
  assert.equal((await getTournamentResults(db, BOB))[0].grantedAt, null);
});

test("point balances and grant history never cross between players", async (t) => {
  const db = await fixture(t);
  await grant(db, ALICE, 70, "tester:iso:alice");
  await grant(db, BOB, 7, "tester:iso:bob");

  assert.equal(await getPointBalance(db, ALICE), 70);
  assert.equal(await getPointBalance(db, BOB), 7);

  const aliceGrants = await getRecentGrants(db, ALICE);
  const bobGrants = await getRecentGrants(db, BOB);
  assert.equal(aliceGrants.length, 1);
  assert.equal(bobGrants.length, 1);
  assert.equal(aliceGrants[0].amount, 70);
  assert.equal(bobGrants[0].amount, 7);
});

test("a wallet linked by one player is not visible on the other", async (t) => {
  const db = await fixture(t);
  const address = "0x24fa54b3e99240c4c7b4b4a68f3f33f01eedec64";
  await linkWalletWithAudit(db, {
    session: { sub: ALICE, sessionId: "s", iat: 0, exp: 0, authMethod: "discord_oauth", assuranceLevel: 2 },
    address,
    previousAddress: null,
    linkedAt: new Date().toISOString(),
  });

  assert.equal((await getPlayer(db, ALICE))?.walletAddress, address);
  assert.equal((await getPlayer(db, BOB))?.walletAddress, null);
});

test("game link codes are per player and never resolve to the other account", async (t) => {
  const db = await fixture(t);
  const alice = await ensureGameLink(db, { sessionSecret: SECRET, gameId: OTOMO_CHAIN_GAME_ID, discordId: ALICE });
  const bob = await ensureGameLink(db, { sessionSecret: SECRET, gameId: OTOMO_CHAIN_GAME_ID, discordId: BOB });

  assert.notEqual(alice.linkCode, bob.linkCode);
  assert.equal((await getGameLink(db, OTOMO_CHAIN_GAME_ID, ALICE))?.linkCode, alice.linkCode);
  assert.equal((await getGameLink(db, OTOMO_CHAIN_GAME_ID, BOB))?.linkCode, bob.linkCode);
});

test("a session token issued for one player never authenticates as the other", async () => {
  const alice = await createSessionArtifact(SECRET, ALICE);
  const bob = await createSessionArtifact(SECRET, BOB);

  const aliceClaims = await verifyPurposeToken(SECRET, "session", alice.token);
  const bobClaims = await verifyPurposeToken(SECRET, "session", bob.token);

  assert.equal(aliceClaims?.sub, ALICE);
  assert.equal(bobClaims?.sub, BOB);
  assert.notEqual(alice.sessionId, bob.sessionId);
  // The browser cookie carries no player identity that a client could edit;
  // substituting one token for the other yields the other player, not a merge.
  assert.notEqual(aliceClaims?.sid, bobClaims?.sid);
});

test("a token signed with a different secret authenticates as nobody", async () => {
  const alice = await createSessionArtifact(SECRET, ALICE);
  const forged = await createSessionArtifact("fedcba9876543210fedcba9876543210", BOB);

  assert.equal(await verifyPurposeToken(SECRET, "session", forged.token), null);
  assert.notEqual(await verifyPurposeToken(SECRET, "session", alice.token), null);
});

test("a session token cannot be replayed for a different purpose", async () => {
  const alice = await createSessionArtifact(SECRET, ALICE);
  assert.equal(await verifyPurposeToken(SECRET, "wallet-challenge", alice.token), null);
  assert.equal(await verifyPurposeToken(SECRET, "oauth-state", alice.token), null);
});
