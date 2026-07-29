import assert from "node:assert/strict";
import test from "node:test";

import { drizzle } from "drizzle-orm/d1";
import { SqliteD1Database, applyProjectMigrations } from "./helpers/sqlite-d1.mjs";

// passport-db uses bundler-style extensionless TypeScript imports in
// production. Register the project's existing TS loader before importing it
// so this test executes that module rather than a copied implementation.
await import("tsx/esm");

const {
  appendPointGrantWithAudit,
  ensureIntegrationActor,
  getGrantByIdempotencyKey,
  getPointBalance,
  getRecentGrants,
  grantRequestFingerprint,
  isUniqueConstraintError,
} = await import("../server/passport-db.ts");

const ACTOR_ID = "200000000000000001";
const TARGET_ID = "300000000000000001";
const OTHER_TARGET_ID = "300000000000000002";
const MISSING_ID = "900000000000000001";

async function fixture(t) {
  const client = new SqliteD1Database();
  await applyProjectMigrations(client.sqlite);
  const db = drizzle(client);
  t.after(() => client.close());
  return { client, db };
}

async function seedPlayers(db, ...discordIds) {
  for (const discordId of discordIds) await ensureIntegrationActor(db, discordId);
}

async function grantInput(overrides = {}) {
  const input = {
    discordId: TARGET_ID,
    amount: 77,
    reasonCode: "INTEGRATION_TEST",
    note: "deterministic D1 grant",
    grantedBy: ACTOR_ID,
    idempotencyKey: "integration:test:grant-0001",
    ...overrides,
  };
  return {
    ...input,
    requestFingerprint: overrides.requestFingerprint ?? await grantRequestFingerprint({
      actor: input.grantedBy,
      discordId: input.discordId,
      amount: input.amount,
      reasonCode: input.reasonCode,
      note: input.note,
    }),
  };
}

function scalar(sqlite, sql, ...params) {
  return Object.values(sqlite.prepare(sql).get(...params))[0];
}

test("the packaged migration chain exposes the constraints required by the grant ledger", async (t) => {
  const { client } = await fixture(t);

  assert.equal(scalar(client.sqlite, "PRAGMA foreign_keys"), 1);
  assert.deepEqual(
    client.sqlite.prepare("PRAGMA table_info(point_grants)").all().map((column) => ({
      name: column.name,
      notnull: column.notnull,
      defaultValue: column.dflt_value,
    })),
    [
      { name: "id", notnull: 1, defaultValue: null },
      { name: "discord_id", notnull: 1, defaultValue: null },
      { name: "amount", notnull: 1, defaultValue: null },
      { name: "reason_code", notnull: 1, defaultValue: null },
      { name: "note", notnull: 0, defaultValue: null },
      { name: "granted_by", notnull: 1, defaultValue: null },
      { name: "idempotency_key", notnull: 1, defaultValue: null },
      { name: "request_fingerprint", notnull: 1, defaultValue: "''" },
      { name: "created_at", notnull: 1, defaultValue: "CURRENT_TIMESTAMP" },
      // Multi-currency ledger: rows written before the column exist as SGP.
      { name: "currency", notnull: 1, defaultValue: "'SGP'" },
    ],
  );

  const foreignKeys = client.sqlite.prepare("PRAGMA foreign_key_list(point_grants)").all()
    .map((row) => ({
      from: row.from,
      table: row.table,
      to: row.to,
      onUpdate: row.on_update,
      onDelete: row.on_delete,
    }))
    .sort((left, right) => left.from.localeCompare(right.from));
  assert.deepEqual(foreignKeys, [
    {
      from: "discord_id",
      table: "players",
      to: "discord_id",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    {
      from: "granted_by",
      table: "players",
      to: "discord_id",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
  ]);

  const indexes = client.sqlite.prepare("PRAGMA index_list(point_grants)").all();
  assert.equal(
    indexes.some((index) => index.name === "point_grants_idempotency_key_unique" && index.unique === 1),
    true,
  );
  assert.deepEqual(
    client.sqlite.prepare("PRAGMA table_info(players)").all()
      .filter((column) => column.name.startsWith("guild_"))
      .map((column) => column.name),
    ["guild_member", "guild_joined_at", "guild_roles", "guild_synced_at"],
  );
});

test("appendPointGrantWithAudit commits the grant and its matching audit atomically", async (t) => {
  const { client, db } = await fixture(t);
  await seedPlayers(db, ACTOR_ID, TARGET_ID);
  const input = await grantInput();

  client.sqlite.exec(`
    CREATE TRIGGER reject_points_audit
    BEFORE INSERT ON audit_events
    WHEN NEW.action = 'POINTS_GRANT'
    BEGIN
      SELECT RAISE(ABORT, 'forced audit failure');
    END
  `);
  await assert.rejects(appendPointGrantWithAudit(db, input), /forced audit failure/);
  assert.equal(scalar(client.sqlite, "SELECT COUNT(*) FROM point_grants"), 0);
  assert.equal(scalar(client.sqlite, "SELECT COUNT(*) FROM audit_events"), 0);

  client.sqlite.exec("DROP TRIGGER reject_points_audit");
  await appendPointGrantWithAudit(db, input);

  const grant = client.sqlite.prepare(`
    SELECT discord_id, amount, reason_code, granted_by, idempotency_key,
      request_fingerprint, created_at
    FROM point_grants
  `).get();
  const audit = client.sqlite.prepare(`
    SELECT actor, action, subject, detail, created_at
    FROM audit_events
  `).get();
  assert.deepEqual({
    discordId: grant.discord_id,
    amount: grant.amount,
    reasonCode: grant.reason_code,
    grantedBy: grant.granted_by,
    idempotencyKey: grant.idempotency_key,
    requestFingerprint: grant.request_fingerprint,
  }, {
    discordId: input.discordId,
    amount: input.amount,
    reasonCode: input.reasonCode,
    grantedBy: input.grantedBy,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: input.requestFingerprint,
  });
  assert.equal(audit.actor, ACTOR_ID);
  assert.equal(audit.action, "POINTS_GRANT");
  assert.equal(audit.subject, TARGET_ID);
  assert.equal(audit.created_at, grant.created_at);
  assert.deepEqual(JSON.parse(audit.detail), {
    amount: input.amount,
    currency: "SGP",
    reasonCode: input.reasonCode,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: input.requestFingerprint,
  });
});

test("idempotency collisions preserve the first fingerprint and never append a second audit", async (t) => {
  const { client, db } = await fixture(t);
  await seedPlayers(db, ACTOR_ID, TARGET_ID);
  const original = await grantInput();
  await appendPointGrantWithAudit(db, original);

  await assert.rejects(
    appendPointGrantWithAudit(db, original),
    (error) => isUniqueConstraintError(error),
  );

  const changedPayload = await grantInput({
    amount: 78,
    note: "same key, different payload",
  });
  assert.notEqual(changedPayload.requestFingerprint, original.requestFingerprint);
  await assert.rejects(
    appendPointGrantWithAudit(db, changedPayload),
    (error) => isUniqueConstraintError(error),
  );

  assert.equal(scalar(client.sqlite, "SELECT COUNT(*) FROM point_grants"), 1);
  assert.equal(scalar(client.sqlite, "SELECT COUNT(*) FROM audit_events WHERE action = 'POINTS_GRANT'"), 1);
  assert.deepEqual(await getGrantByIdempotencyKey(db, original.idempotencyKey), {
    discordId: original.discordId,
    amount: original.amount,
    currency: "SGP",
    reasonCode: original.reasonCode,
    note: original.note,
    grantedBy: original.grantedBy,
    requestFingerprint: original.requestFingerprint,
  });
});

test("both the target and granting actor must be registered players", async (t) => {
  const { client, db } = await fixture(t);
  await seedPlayers(db, ACTOR_ID, TARGET_ID);
  // The service actor registration itself is idempotent.
  await ensureIntegrationActor(db, ACTOR_ID);
  assert.equal(
    scalar(client.sqlite, "SELECT COUNT(*) FROM players WHERE discord_id = ?", ACTOR_ID),
    1,
  );

  await assert.rejects(
    appendPointGrantWithAudit(db, await grantInput({
      discordId: MISSING_ID,
      idempotencyKey: "integration:test:missing-target",
    })),
    /FOREIGN KEY constraint failed/,
  );
  await assert.rejects(
    appendPointGrantWithAudit(db, await grantInput({
      grantedBy: MISSING_ID,
      idempotencyKey: "integration:test:missing-actor",
    })),
    /FOREIGN KEY constraint failed/,
  );

  assert.equal(scalar(client.sqlite, "SELECT COUNT(*) FROM point_grants"), 0);
  assert.equal(scalar(client.sqlite, "SELECT COUNT(*) FROM audit_events WHERE action = 'POINTS_GRANT'"), 0);
});

test("getPointBalance sums only the requested player's append-only grants", async (t) => {
  const { client, db } = await fixture(t);
  await seedPlayers(db, ACTOR_ID, TARGET_ID, OTHER_TARGET_ID);

  await appendPointGrantWithAudit(db, await grantInput());
  await appendPointGrantWithAudit(db, await grantInput({
    amount: 23,
    note: null,
    idempotencyKey: "integration:test:grant-0002",
  }));
  await appendPointGrantWithAudit(db, await grantInput({
    discordId: OTHER_TARGET_ID,
    amount: 700,
    idempotencyKey: "integration:test:other-player",
  }));

  assert.equal(await getPointBalance(db, TARGET_ID), 100);
  assert.equal(await getPointBalance(db, OTHER_TARGET_ID), 700);
  assert.equal(await getPointBalance(db, MISSING_ID), 0);
  const recent = await getRecentGrants(db, TARGET_ID, 2);
  assert.equal(recent.length, 2);
  for (const grant of recent) assert.match(grant.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(recent.map((grant) => ({
    amount: grant.amount,
    reasonCode: grant.reasonCode,
    note: grant.note,
  })), [
    {
      amount: 23,
      reasonCode: "INTEGRATION_TEST",
      note: null,
    },
    {
      amount: 77,
      reasonCode: "INTEGRATION_TEST",
      note: "deterministic D1 grant",
    },
  ]);
  assert.equal(scalar(client.sqlite, "SELECT COUNT(*) FROM audit_events WHERE action = 'POINTS_GRANT'"), 3);
});
