import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const MIGRATION_BREAKPOINT = "--> statement-breakpoint";

function asNumber(value) {
  return typeof value === "bigint" ? Number(value) : value;
}

function resultMeta(summary, changedDb) {
  return {
    changed_db: changedDb,
    changes: asNumber(summary?.changes ?? 0),
    duration: 0,
    last_row_id: asNumber(summary?.lastInsertRowid ?? 0),
    rows_read: 0,
    rows_written: asNumber(summary?.changes ?? 0),
    size_after: 0,
  };
}

class SqliteD1PreparedStatement {
  constructor(owner, sql, params = []) {
    this.owner = owner;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new SqliteD1PreparedStatement(this.owner, this.sql, params);
  }

  #prepare() {
    return this.owner.sqlite.prepare(this.sql);
  }

  async all() {
    const statement = this.#prepare();
    const results = statement.all(...this.params);
    return {
      success: true,
      results,
      meta: resultMeta(undefined, false),
    };
  }

  async first(column) {
    const row = (await this.all()).results[0];
    if (!row) return null;
    return column === undefined ? row : row[column] ?? null;
  }

  async raw() {
    const rows = (await this.all()).results;
    return rows.map((row) => Object.keys(row).map((key) => row[key]));
  }

  async run() {
    const statement = this.#prepare();
    if (statement.columns().length > 0) {
      const results = statement.all(...this.params);
      return {
        success: true,
        results,
        meta: resultMeta(undefined, false),
      };
    }

    const summary = statement.run(...this.params);
    return {
      success: true,
      results: [],
      meta: resultMeta(summary, summary.changes > 0),
    };
  }
}

/**
 * Minimal D1-compatible client over Node's in-memory SQLite. The batch method
 * deliberately matches D1's all-or-nothing transaction semantics so the
 * production Drizzle batch functions can be exercised without a server.
 */
export class SqliteD1Database {
  constructor(sqlite = new DatabaseSync(":memory:")) {
    this.sqlite = sqlite;
    this.sqlite.exec("PRAGMA foreign_keys = ON");
  }

  prepare(sql) {
    return new SqliteD1PreparedStatement(this, sql);
  }

  async batch(statements) {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  close() {
    this.sqlite.close();
  }
}

export function applyMigration(sqlite, source) {
  for (const statement of source
    .split(MIGRATION_BREAKPOINT)
    .map((part) => part.trim())
    .filter(Boolean)) {
    sqlite.exec(statement);
  }
}

export async function applyProjectMigrations(sqlite) {
  for (const migration of [
    "0000_brave_rachel_grey.sql",
    "0001_majestic_boomer.sql",
    "0002_bent_spiral.sql",
    "0003_previous_nitro.sql",
    "0004_yielding_dormammu.sql",
    "0005_same_madripoor.sql",
    "0006_married_nighthawk.sql",
  ]) {
    const source = await readFile(
      new URL(`../../drizzle/${migration}`, import.meta.url),
      "utf8",
    );
    applyMigration(sqlite, source);
  }
}
