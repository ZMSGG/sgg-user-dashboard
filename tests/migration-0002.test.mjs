import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const BREAKPOINT = "--> statement-breakpoint";

async function readMigration(name) {
  return readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
}

function applyMigration(db, sql) {
  for (const statement of sql.split(BREAKPOINT).map((part) => part.trim()).filter(Boolean)) {
    db.exec(statement);
  }
}

test("migration 0002 preserves deployed data and adds nullable guild snapshot columns", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");

  applyMigration(db, await readMigration("0000_brave_rachel_grey.sql"));
  db.prepare(`
    INSERT INTO players (discord_id, discord_username, created_at, last_login_at)
    VALUES (?, ?, ?, ?)
  `).run("111111111111111111", "existing-player", "2026-07-20T00:00:00Z", "2026-07-21T00:00:00Z");
  db.prepare(`
    INSERT INTO point_grants
      (discord_id, amount, reason_code, note, granted_by, idempotency_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    "111111111111111111",
    77,
    "LEGACY_IMPORT",
    "existing ledger row",
    "111111111111111111",
    "legacy-grant-0001",
    "2026-07-21T00:00:00Z",
  );

  applyMigration(db, await readMigration("0001_majestic_boomer.sql"));
  applyMigration(db, await readMigration("0002_bent_spiral.sql"));

  const player = db.prepare(`
    SELECT discord_id, discord_username, guild_member, guild_joined_at,
      guild_roles, guild_synced_at
    FROM players WHERE discord_id = ?
  `).get("111111111111111111");
  assert.deepEqual({ ...player }, {
    discord_id: "111111111111111111",
    discord_username: "existing-player",
    guild_member: null,
    guild_joined_at: null,
    guild_roles: null,
    guild_synced_at: null,
  });

  const grant = db.prepare(`
    SELECT amount, reason_code, note, idempotency_key, request_fingerprint
    FROM point_grants WHERE idempotency_key = ?
  `).get("legacy-grant-0001");
  assert.deepEqual({ ...grant }, {
    amount: 77,
    reason_code: "LEGACY_IMPORT",
    note: "existing ledger row",
    idempotency_key: "legacy-grant-0001",
    request_fingerprint: "",
  });

  const guildColumns = db.prepare("PRAGMA table_info(players)").all()
    .filter((column) => column.name.startsWith("guild_"));
  assert.deepEqual(
    guildColumns.map((column) => ({ name: column.name, notnull: column.notnull, defaultValue: column.dflt_value })),
    [
      { name: "guild_member", notnull: 0, defaultValue: null },
      { name: "guild_joined_at", notnull: 0, defaultValue: null },
      { name: "guild_roles", notnull: 0, defaultValue: null },
      { name: "guild_synced_at", notnull: 0, defaultValue: null },
    ],
  );
});

test("migration journal packages the guild and DM auth migrations exactly once", async () => {
  const journal = JSON.parse(
    await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(
    journal.entries.map((entry) => entry.tag),
    [
      "0000_brave_rachel_grey",
      "0001_majestic_boomer",
      "0002_bent_spiral",
      "0003_previous_nitro",
      "0004_yielding_dormammu",
      "0005_same_madripoor",
    ],
  );
  assert.equal(journal.entries.at(-1)?.idx, 5);
  assert.match(await readMigration("0002_bent_spiral.sql"), /ADD `guild_synced_at` text/);
  assert.match(await readMigration("0003_previous_nitro.sql"), /CREATE TABLE `discord_dm_challenges`/);
  assert.match(await readMigration("0004_yielding_dormammu.sql"), /CREATE TABLE `game_account_links`/);
  // One game account must never resolve to two Passports.
  assert.match(
    await readMigration("0004_yielding_dormammu.sql"),
    /CREATE UNIQUE INDEX `game_account_links_game_player_unique`/,
  );
  assert.match(await readMigration("0005_same_madripoor.sql"), /CREATE TABLE `gacha_pulls`/);
  assert.match(await readMigration("0005_same_madripoor.sql"), /`currency` text DEFAULT 'SGP' NOT NULL/);
  assert.match(await readMigration("0005_same_madripoor.sql"), /point_grants_nonnegative_currency_balance/);
  assert.match(await readMigration("0005_same_madripoor.sql"), /SGG_INSUFFICIENT_CURRENCY_BALANCE/);
});
