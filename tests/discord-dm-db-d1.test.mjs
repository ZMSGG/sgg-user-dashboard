import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { drizzle } from "drizzle-orm/d1";
import {
  SqliteD1Database,
  applyMigration,
  applyProjectMigrations,
} from "./helpers/sqlite-d1.mjs";

await import("tsx/esm");

const {
  consumeDiscordDmChallenge,
  consumeDiscordDmRateLimit,
  createDiscordDmChallenge,
  establishDiscordSession,
  getPendingDiscordDmChallenge,
  invalidateDiscordDmChallenge,
  recordDiscordDmChallengeFailure,
} = await import("../server/passport-db.ts");

const DISCORD_ID = "300000000000000001";
const CHALLENGE_DIGEST = "a".repeat(64);
const NONCE_DIGEST = "b".repeat(64);
const CODE_DIGEST = "c".repeat(64);

async function fixture(t) {
  const client = new SqliteD1Database();
  await applyProjectMigrations(client.sqlite);
  const db = drizzle(client);
  t.after(() => client.close());
  return { client, db };
}

async function migration(name) {
  return readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
}

test("migration 0003 preserves legacy OAuth sessions as high assurance", async (t) => {
  const client = new SqliteD1Database();
  t.after(() => client.close());
  for (const name of [
    "0000_brave_rachel_grey.sql",
    "0001_majestic_boomer.sql",
    "0002_bent_spiral.sql",
  ]) {
    applyMigration(client.sqlite, await migration(name));
  }
  client.sqlite.prepare(`
    INSERT INTO players (discord_id, discord_username) VALUES (?, ?)
  `).run(DISCORD_ID, "legacy-user");
  client.sqlite.prepare(`
    INSERT INTO auth_sessions (id, discord_id, expires_at) VALUES (?, ?, ?)
  `).run("legacy-session", DISCORD_ID, 2_000_000_000);
  client.sqlite.prepare(`
    INSERT INTO wallet_challenges
      (id, session_id, discord_id, address, nonce, origin, issued_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "legacy-wallet-challenge",
    "legacy-session",
    DISCORD_ID,
    "0x0000000000000000000000000000000000000001",
    "legacy-nonce",
    "https://player.example",
    "2026-07-22T00:00:00.000Z",
    2_000_000_000,
  );

  applyMigration(client.sqlite, await migration("0003_previous_nitro.sql"));
  const session = client.sqlite.prepare(`
    SELECT auth_method, assurance_level FROM auth_sessions WHERE id = ?
  `).get("legacy-session");
  assert.deepEqual({ ...session }, {
    auth_method: "discord_oauth",
    assurance_level: 2,
  });
  assert.equal(client.sqlite.prepare(`
    SELECT session_id FROM wallet_challenges WHERE id = ?
  `).get("legacy-wallet-challenge").session_id, "legacy-session");
  assert.deepEqual(client.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  assert.throws(() => client.sqlite.prepare(`
    INSERT INTO auth_sessions
      (id, discord_id, expires_at, auth_method, assurance_level)
    VALUES (?, ?, ?, ?, ?)
  `).run("bad-session", DISCORD_ID, 2_000_000_000, "discord_dm", 2), /invalid auth session assurance/);
  assert.throws(() => client.sqlite.prepare(`
    UPDATE auth_sessions SET auth_method = ?, assurance_level = ? WHERE id = ?
  `).run("discord_dm", 2, "legacy-session"), /invalid auth session assurance/);
});

test("DM challenge compare-and-set permits exactly one concurrent consume", async (t) => {
  const { client, db } = await fixture(t);
  await createDiscordDmChallenge(db, {
    challengeIdDigest: CHALLENGE_DIGEST,
    discordId: DISCORD_ID,
    clientNonceDigest: NONCE_DIGEST,
    codeDigest: CODE_DIGEST,
    createdAt: "2033-05-18T03:33:20.000Z",
    expiresAt: 2_000_000_300,
  });
  assert.equal((await getPendingDiscordDmChallenge(db, {
    challengeIdDigest: CHALLENGE_DIGEST,
    clientNonceDigest: NONCE_DIGEST,
    nowSeconds: 2_000_000_001,
  }))?.discordId, DISCORD_ID);

  const input = {
    challengeIdDigest: CHALLENGE_DIGEST,
    clientNonceDigest: NONCE_DIGEST,
    codeDigest: CODE_DIGEST,
    nowSeconds: 2_000_000_002,
    consumedAt: "2033-05-18T03:33:22.000Z",
  };
  const results = await Promise.all([
    consumeDiscordDmChallenge(db, input),
    consumeDiscordDmChallenge(db, input),
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(await getPendingDiscordDmChallenge(db, {
    challengeIdDigest: CHALLENGE_DIGEST,
    clientNonceDigest: NONCE_DIGEST,
    nowSeconds: 2_000_000_003,
  }), null);
  assert.equal(
    client.sqlite.prepare("SELECT COUNT(*) AS count FROM discord_dm_challenges").get().count,
    1,
  );
  await assert.rejects(createDiscordDmChallenge(db, {
    challengeIdDigest: "9".repeat(64),
    discordId: DISCORD_ID,
    clientNonceDigest: NONCE_DIGEST,
    codeDigest: CODE_DIGEST,
    createdAt: "2033-05-18T03:33:20.000Z",
    expiresAt: 2_000_000_301,
  }), /challenge is invalid/);
});

test("wrong codes are bounded to five attempts and terminally consumed", async (t) => {
  const { client, db } = await fixture(t);
  await createDiscordDmChallenge(db, {
    challengeIdDigest: CHALLENGE_DIGEST,
    discordId: DISCORD_ID,
    clientNonceDigest: NONCE_DIGEST,
    codeDigest: CODE_DIGEST,
    createdAt: "2033-05-18T03:33:20.000Z",
    expiresAt: 2_000_000_300,
  });
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await recordDiscordDmChallengeFailure(db, {
      challengeIdDigest: CHALLENGE_DIGEST,
      clientNonceDigest: NONCE_DIGEST,
      nowSeconds: 2_000_000_000 + attempt,
      failedAt: `2033-05-18T03:33:2${attempt}.000Z`,
    });
    assert.equal(result.recorded, true);
    assert.equal(result.attempts, attempt);
    assert.equal(result.terminal, attempt === 5);
  }
  const sixth = await recordDiscordDmChallengeFailure(db, {
    challengeIdDigest: CHALLENGE_DIGEST,
    clientNonceDigest: NONCE_DIGEST,
    nowSeconds: 2_000_000_006,
    failedAt: "2033-05-18T03:33:26.000Z",
  });
  assert.deepEqual(sixth, { recorded: false, terminal: true, attempts: 5 });
  const row = client.sqlite.prepare(`
    SELECT attempts, consumed_at FROM discord_dm_challenges
  `).get();
  assert.equal(row.attempts, 5);
  assert.equal(row.consumed_at, "2033-05-18T03:33:25.000Z");
});

test("DM start quotas enforce cooldown, hourly maximum, and atomic reset", async (t) => {
  const { client, db } = await fixture(t);
  const input = {
    scope: "ip",
    subjectDigest: "d".repeat(64),
    cooldownSeconds: 30,
    windowSeconds: 3_600,
    maxAttempts: 5,
  };
  assert.equal(await consumeDiscordDmRateLimit(db, { ...input, nowSeconds: 1_000 }), true);
  assert.equal(await consumeDiscordDmRateLimit(db, { ...input, nowSeconds: 1_001 }), false);
  for (const nowSeconds of [1_030, 1_060, 1_090, 1_120]) {
    assert.equal(await consumeDiscordDmRateLimit(db, { ...input, nowSeconds }), true);
  }
  assert.equal(await consumeDiscordDmRateLimit(db, { ...input, nowSeconds: 1_150 }), false);
  assert.equal(await consumeDiscordDmRateLimit(db, { ...input, nowSeconds: 4_600 }), true);

  const row = client.sqlite.prepare(`
    SELECT attempts, window_start, last_attempt_at, subject_digest
    FROM discord_dm_rate_limits WHERE scope = 'ip'
  `).get();
  assert.deepEqual({
    attempts: row.attempts,
    windowStart: row.window_start,
    lastAttemptAt: row.last_attempt_at,
  }, {
    attempts: 1,
    windowStart: 4_600,
    lastAttemptAt: 4_600,
  });
  assert.match(row.subject_digest, /^[0-9a-f]{64}$/);

  const global = {
    scope: "global",
    subjectDigest: "8".repeat(64),
    cooldownSeconds: 0,
    windowSeconds: 60,
    maxAttempts: 30,
  };
  for (let attempt = 0; attempt < 30; attempt += 1) {
    assert.equal(await consumeDiscordDmRateLimit(db, {
      ...global,
      nowSeconds: 5_000,
    }), true);
  }
  assert.equal(await consumeDiscordDmRateLimit(db, { ...global, nowSeconds: 5_000 }), false);
  assert.equal(await consumeDiscordDmRateLimit(db, { ...global, nowSeconds: 5_060 }), true);
  assert.equal(await consumeDiscordDmRateLimit(db, {
    ...global,
    maxAttempts: 31,
    nowSeconds: 5_061,
  }), false);
});

test("low-assurance session metadata and login method are audited atomically", async (t) => {
  const { client, db } = await fixture(t);
  await establishDiscordSession(db, {
    id: DISCORD_ID,
    username: "dm-user",
    globalName: "DM User",
    avatarHash: null,
  }, {
    id: "e".repeat(64),
    expiresAt: 2_000_086_400,
    authMethod: "discord_dm",
    assuranceLevel: 1,
  });
  const session = client.sqlite.prepare(`
    SELECT auth_method, assurance_level FROM auth_sessions
  `).get();
  assert.deepEqual({ ...session }, {
    auth_method: "discord_dm",
    assurance_level: 1,
  });
  const audit = client.sqlite.prepare(`
    SELECT action, detail FROM audit_events WHERE action = 'DISCORD_LOGIN'
  `).get();
  assert.equal(audit.action, "DISCORD_LOGIN");
  assert.deepEqual(JSON.parse(audit.detail), {
    sessionId: "eeeeeeeeeeeeeeee",
    authMethod: "discord_dm",
    assuranceLevel: 1,
  });

  await invalidateDiscordDmChallenge(db, {
    challengeIdDigest: "f".repeat(64),
    invalidatedAt: "2033-05-18T03:33:20.000Z",
  });
});
