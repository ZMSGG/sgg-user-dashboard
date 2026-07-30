#!/usr/bin/env node
/**
 * /api/admin/export のJSONを、新D1へ流し込むSQLに変換する。
 *
 *   node scripts/import-export.mjs my-sgg-export.json > import.sql
 *   npx wrangler d1 execute my-sgg-player-os --remote --file=import.sql
 *
 * 前提: 対象D1には drizzle/0000〜0005 が適用済みで、対象テーブルは空。
 * INSERT OR FAIL を使い、既存行があれば止まる（黙って上書きしない）。
 */
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/import-export.mjs <export.json>");
  process.exit(1);
}
const data = JSON.parse(readFileSync(path, "utf8"));
const tables = data.tables;
if (!tables) {
  console.error("export.json に tables がありません");
  process.exit(1);
}

// エクスポートはcamelCase（drizzleの列名マップ）で出る。D1の実列名へ戻す。
const COLUMN_MAPS = {
  players: {
    discordId: "discord_id", discordUsername: "discord_username",
    discordGlobalName: "discord_global_name", discordAvatarHash: "discord_avatar_hash",
    walletAddress: "wallet_address", walletLinkedAt: "wallet_linked_at",
    guildMember: "guild_member", guildJoinedAt: "guild_joined_at",
    guildRoles: "guild_roles", guildSyncedAt: "guild_synced_at",
    createdAt: "created_at", lastLoginAt: "last_login_at",
  },
  point_grants: {
    id: "id", discordId: "discord_id", amount: "amount", currency: "currency",
    reasonCode: "reason_code", note: "note", grantedBy: "granted_by",
    idempotencyKey: "idempotency_key", requestFingerprint: "request_fingerprint",
    createdAt: "created_at",
  },
  gacha_pulls: {
    id: "id", discordId: "discord_id", poolId: "pool_id", cardId: "card_id",
    rarity: "rarity", idempotencyKey: "idempotency_key", createdAt: "created_at",
  },
  game_account_links: {
    gameId: "game_id", discordId: "discord_id", linkCode: "link_code",
    issuedAt: "issued_at", gamePlayerId: "game_player_id",
    verifiedAt: "verified_at", verifiedSeasonId: "verified_season_id",
  },
  audit_events: {
    id: "id", actor: "actor", action: "action", subject: "subject",
    detail: "detail", createdAt: "created_at",
  },
};

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite number in export");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

// 外部キー順: players が先。
const ORDER = ["players", "point_grants", "gacha_pulls", "game_account_links", "audit_events"];
let statements = 0;
console.log("PRAGMA defer_foreign_keys = on;");
for (const table of ORDER) {
  const rows = tables[table] ?? [];
  const map = COLUMN_MAPS[table];
  for (const row of rows) {
    const cols = Object.keys(map).filter((k) => row[k] !== undefined);
    const names = cols.map((k) => map[k]).join(", ");
    const values = cols.map((k) => sqlLiteral(row[k])).join(", ");
    console.log(`INSERT OR FAIL INTO ${table} (${names}) VALUES (${values});`);
    statements += 1;
  }
}
console.error(`generated ${statements} inserts`);
