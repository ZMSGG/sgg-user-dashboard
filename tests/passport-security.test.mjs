import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWalletMessage,
  canonicalAppOrigin,
  discordAuthConfigFromEnv,
  grantRequestFingerprint,
  hasRecentAuthentication,
  isStrongSessionSecret,
  isUniqueConstraintError,
  normalizeWalletAddress,
  resolveAppOrigin,
  signPurposeToken,
  verifyPurposeToken,
} from "../server/auth.ts";

const STRONG_SECRET = "r4V!xP9#qL2@tN7$wK5&cM8*zD3+hF6=";
const TEST_DISCORD_ID = "1".repeat(18);

test("purpose-bound tokens cannot cross authentication contexts", async () => {
  const now = 2_000_000_000;
  const sessionToken = await signPurposeToken(STRONG_SECRET, "session", {
    sub: TEST_DISCORD_ID,
    sid: "a-secure-random-session-identifier",
    iat: now,
    exp: now + 600,
  });

  const claims = await verifyPurposeToken(STRONG_SECRET, "session", sessionToken, now + 1);
  assert.equal(claims?.sub, TEST_DISCORD_ID);
  assert.equal(await verifyPurposeToken(STRONG_SECRET, "oauth-state", sessionToken, now + 1), null);
  assert.equal(await verifyPurposeToken(STRONG_SECRET, "session", `${sessionToken}x`, now + 1), null);
  assert.equal(await verifyPurposeToken(STRONG_SECRET, "session", sessionToken, now + 601), null);
});

test("weak authentication configuration fails closed", () => {
  assert.equal(isStrongSessionSecret("short"), false);
  assert.equal(isStrongSessionSecret("a".repeat(64)), false);
  assert.equal(isStrongSessionSecret(` ${STRONG_SECRET}`), false);
  assert.equal(isStrongSessionSecret(STRONG_SECRET), true);

  const fakeDb = {};
  assert.equal(discordAuthConfigFromEnv({
    DB: fakeDb,
    DISCORD_CLIENT_ID: TEST_DISCORD_ID,
    DISCORD_CLIENT_SECRET: "too-short",
    SESSION_SECRET: STRONG_SECRET,
  }), null);
  assert.ok(discordAuthConfigFromEnv({
    DB: fakeDb,
    DISCORD_CLIENT_ID: TEST_DISCORD_ID,
    DISCORD_CLIENT_SECRET: "discord-client-secret-material-1234",
    SESSION_SECRET: STRONG_SECRET,
  }));
});

test("canonical origin validation rejects host-header and path substitution", () => {
  assert.equal(canonicalAppOrigin("https://sevengods.games/"), "https://sevengods.games");
  assert.equal(canonicalAppOrigin("https://sevengods.games/callback"), null);
  assert.equal(canonicalAppOrigin("http://sevengods.games"), null);
  assert.equal(canonicalAppOrigin("http://127.0.0.1:3000"), "http://127.0.0.1:3000");

  const canonicalRequest = new Request("https://sevengods.games/api/auth/discord");
  const foreignRequest = new Request("https://evil.example/api/auth/discord");
  assert.equal(resolveAppOrigin(canonicalRequest, "https://sevengods.games"), "https://sevengods.games");
  assert.equal(resolveAppOrigin(foreignRequest, "https://sevengods.games"), null);
  assert.equal(resolveAppOrigin(foreignRequest, undefined), "https://evil.example");
});

test("wallet proof is normalized and cryptographically bound to the requested address", () => {
  const mixedCase = "0xAa000000000000000000000000000000000000Bb";
  const address = normalizeWalletAddress(mixedCase);
  assert.equal(address, mixedCase.toLowerCase());
  assert.equal(normalizeWalletAddress("0x1234"), null);

  const message = buildWalletMessage({
    discordId: TEST_DISCORD_ID,
    address,
    nonce: "nonce-1",
    issuedAt: "2033-05-18T03:33:20.000Z",
    origin: "https://sevengods.games",
  });
  assert.match(message, new RegExp(`Wallet: ${address}`));
  assert.match(message, /Origin: https:\/\/sevengods\.games/);
  assert.match(message, new RegExp(`Discord ID: ${TEST_DISCORD_ID}`));
});

test("point grant fingerprint is deterministic and payload-sensitive", async () => {
  const base = {
    actor: "111111111111111111",
    discordId: "222222222222222222",
    amount: 75,
    reasonCode: "TOURNAMENT_REWARD",
    note: "Final placement",
  };
  const first = await grantRequestFingerprint(base);
  const retry = await grantRequestFingerprint({ ...base });
  const altered = await grantRequestFingerprint({ ...base, amount: 76 });
  const otherActor = await grantRequestFingerprint({ ...base, actor: "333333333333333333" });
  const explicitSgp = await grantRequestFingerprint({ ...base, currency: "SGP" });
  const magatama = await grantRequestFingerprint({ ...base, currency: "MAGATAMA" });
  const fukusen = await grantRequestFingerprint({ ...base, currency: "FUKUSEN" });

  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(retry, first);
  assert.equal(explicitSgp, first, "legacy SGP fingerprints remain retry-compatible");
  assert.notEqual(altered, first);
  assert.notEqual(otherActor, first);
  assert.notEqual(magatama, first);
  assert.notEqual(magatama, fukusen);
});

test("D1 unique races are recognized without swallowing unrelated failures", () => {
  assert.equal(isUniqueConstraintError(new Error("UNIQUE constraint failed: players.wallet_address")), true);
  assert.equal(isUniqueConstraintError(new Error("D1_ERROR: UNIQUE constraint failed")), true);
  assert.equal(isUniqueConstraintError(new Error("network unavailable")), false);
});

test("sensitive admin actions require a recent authenticated session", () => {
  const session = {
    sub: TEST_DISCORD_ID,
    sessionId: "session-digest",
    iat: 2_000_000_000,
    exp: 2_000_604_800,
    authMethod: "discord_oauth",
    assuranceLevel: 2,
  };
  assert.equal(hasRecentAuthentication(session, 900, 2_000_000_899), true);
  assert.equal(hasRecentAuthentication(session, 900, 2_000_000_901), false);
  assert.equal(hasRecentAuthentication(session, 900, 1_999_999_999), false);
  assert.equal(hasRecentAuthentication({
    ...session,
    authMethod: "discord_dm",
    assuranceLevel: 1,
  }, 900, 2_000_000_100), false);
});
