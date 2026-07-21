import test from "node:test";
import assert from "node:assert/strict";

import {
  buildIntegrationSignature,
  integrationConfigFromEnv,
  verifyIntegrationRequest,
} from "../server/integration-auth.ts";
import {
  guildSyncConfigFromEnv,
  isGuildSyncCooldownActive,
  parseGuildRoles,
} from "../server/discord-guild.ts";
import { parseGrantPayload } from "../server/grant-validation.ts";

const STRONG_SECRET = "r4V!xP9#qL2@tN7$wK5&cM8*zD3+hF6=";
const ACTOR_ID = "2".repeat(18);
const NOW = 2_000_000_000;

test("integration configuration fails closed on weak or missing values", () => {
  assert.equal(integrationConfigFromEnv({}), null);
  assert.equal(integrationConfigFromEnv({
    INTEGRATION_GRANT_SECRET: "short",
    INTEGRATION_ACTOR_ID: ACTOR_ID,
  }), null);
  assert.equal(integrationConfigFromEnv({
    INTEGRATION_GRANT_SECRET: STRONG_SECRET,
    INTEGRATION_ACTOR_ID: "not-a-snowflake",
  }), null);
  assert.deepEqual(integrationConfigFromEnv({
    INTEGRATION_GRANT_SECRET: STRONG_SECRET,
    INTEGRATION_ACTOR_ID: ACTOR_ID,
  }), { secret: STRONG_SECRET, actorId: ACTOR_ID });
});

test("integration signatures bind the secret, timestamp, and exact body", async () => {
  const body = JSON.stringify({ discordId: ACTOR_ID, amount: 10 });
  const signature = await buildIntegrationSignature(STRONG_SECRET, NOW, body);
  assert.match(signature, /^v1=[0-9a-f]{64}$/);

  const ok = await verifyIntegrationRequest(STRONG_SECRET, String(NOW), signature, body, NOW + 5);
  assert.deepEqual(ok, { ok: true, timestamp: NOW });

  const tamperedBody = await verifyIntegrationRequest(
    STRONG_SECRET, String(NOW), signature, body.replace("10", "11"), NOW + 5);
  assert.equal(tamperedBody.ok, false);
  assert.equal(tamperedBody.reason, "BAD_SIGNATURE");

  const shiftedTimestamp = await verifyIntegrationRequest(
    STRONG_SECRET, String(NOW + 1), signature, body, NOW + 5);
  assert.equal(shiftedTimestamp.ok, false);

  const wrongSecret = await verifyIntegrationRequest(
    `${STRONG_SECRET}x`, String(NOW), signature, body, NOW + 5);
  assert.equal(wrongSecret.ok, false);
});

test("integration timestamps outside the window are rejected", async () => {
  const body = "{}";
  const signature = await buildIntegrationSignature(STRONG_SECRET, NOW, body);
  const stale = await verifyIntegrationRequest(STRONG_SECRET, String(NOW), signature, body, NOW + 301);
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, "STALE_TIMESTAMP");

  const malformed = await verifyIntegrationRequest(STRONG_SECRET, "12x", signature, body, NOW);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.reason, "BAD_TIMESTAMP");

  const badFormat = await verifyIntegrationRequest(STRONG_SECRET, String(NOW), "v2=abc", body, NOW);
  assert.equal(badFormat.ok, false);
  assert.equal(badFormat.reason, "BAD_SIGNATURE");
});

test("guild sync configuration fails closed and cooldown throttles re-sync", () => {
  assert.equal(guildSyncConfigFromEnv({}), null);
  assert.equal(guildSyncConfigFromEnv({
    DISCORD_BOT_TOKEN: "short-token",
    DISCORD_GUILD_ID: ACTOR_ID,
  }), null);
  assert.equal(guildSyncConfigFromEnv({
    DISCORD_BOT_TOKEN: "a".repeat(60),
    DISCORD_GUILD_ID: "guild",
  }), null);
  assert.deepEqual(guildSyncConfigFromEnv({
    DISCORD_BOT_TOKEN: "a".repeat(60),
    DISCORD_GUILD_ID: ACTOR_ID,
  }), { botToken: "a".repeat(60), guildId: ACTOR_ID });

  const nowMs = 1_700_000_000_000;
  assert.equal(isGuildSyncCooldownActive(null, nowMs), false);
  assert.equal(isGuildSyncCooldownActive("not-a-date", nowMs), false);
  assert.equal(isGuildSyncCooldownActive(new Date(nowMs - 30_000).toISOString(), nowMs), true);
  assert.equal(isGuildSyncCooldownActive(new Date(nowMs - 61_000).toISOString(), nowMs), false);

  assert.deepEqual(parseGuildRoles(null), []);
  assert.deepEqual(parseGuildRoles("broken json"), []);
  assert.deepEqual(parseGuildRoles(JSON.stringify(["1", 2, "3"])), ["1", "3"]);
});

test("grant payload validation is shared and strict", () => {
  const valid = parseGrantPayload({
    discordId: ACTOR_ID,
    amount: 100,
    reasonCode: "TESTER_REWARD",
    note: "  first cohort  ",
    idempotencyKey: "campaign-1:player-2",
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.value.note, "first cohort");

  assert.equal(parseGrantPayload({ discordId: "abc", amount: 1, reasonCode: "AAA", idempotencyKey: "12345678" }).ok, false);
  assert.equal(parseGrantPayload({ discordId: ACTOR_ID, amount: 0, reasonCode: "AAA", idempotencyKey: "12345678" }).ok, false);
  assert.equal(parseGrantPayload({ discordId: ACTOR_ID, amount: 1.5, reasonCode: "AAA", idempotencyKey: "12345678" }).ok, false);
  assert.equal(parseGrantPayload({ discordId: ACTOR_ID, amount: 1, reasonCode: "bad-code", idempotencyKey: "12345678" }).ok, false);
  assert.equal(parseGrantPayload({ discordId: ACTOR_ID, amount: 1, reasonCode: "AAA", idempotencyKey: "short" }).ok, false);
  assert.equal(parseGrantPayload({ discordId: ACTOR_ID, amount: 1, reasonCode: "AAA", note: "x".repeat(501), idempotencyKey: "12345678" }).ok, false);
});
