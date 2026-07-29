import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Player OS persistence. Rules from docs/PLAYER_OS_ARCHITECTURE.md:
 * Discord user ID is the only identity key, wallets are optional and
 * 1:1 per player, and every point movement is an append-only ledger row
 * written through an authenticated server session with an idempotency key.
 */

export const players = sqliteTable("players", {
  discordId: text("discord_id").primaryKey(),
  discordUsername: text("discord_username").notNull(),
  discordGlobalName: text("discord_global_name"),
  discordAvatarHash: text("discord_avatar_hash"),
  walletAddress: text("wallet_address"),
  walletLinkedAt: text("wallet_linked_at"),
  // Guild membership is a synced snapshot, never an assertion: NULL means the
  // membership has not been determined yet, 0/1 only after a successful sync.
  guildMember: integer("guild_member"),
  guildJoinedAt: text("guild_joined_at"),
  guildRoles: text("guild_roles"),
  guildSyncedAt: text("guild_synced_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastLoginAt: text("last_login_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("players_wallet_address_unique")
    .on(table.walletAddress)
    .where(sql`wallet_address IS NOT NULL`),
  index("players_last_login_at_idx").on(table.lastLoginAt),
]);

/**
 * Server-side session registry. The signed browser cookie carries a random
 * session id, while only its SHA-256 digest is stored here. A valid signature
 * is therefore necessary but not sufficient: the row must also be active.
 */
export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  discordId: text("discord_id")
    .notNull()
    .references(() => players.discordId, { onDelete: "cascade", onUpdate: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: text("revoked_at"),
  // The D1 row, not a browser assertion, is authoritative for assurance.
  // Legacy rows predate DM auth and therefore default to Discord OAuth.
  authMethod: text("auth_method").notNull().default("discord_oauth"),
  assuranceLevel: integer("assurance_level").notNull().default(2),
}, (table) => [
  index("auth_sessions_discord_id_idx").on(table.discordId),
  index("auth_sessions_expires_at_idx").on(table.expiresAt),
]);

/**
 * One-time Discord DM login challenges. Only digests of the browser-visible
 * challenge id, browser-bound nonce, and code are durable. Discord ID remains
 * the formal Player Passport identity and is needed for a fresh guild check.
 */
export const discordDmChallenges = sqliteTable("discord_dm_challenges", {
  challengeIdDigest: text("challenge_id_digest").primaryKey(),
  discordId: text("discord_id").notNull(),
  clientNonceDigest: text("client_nonce_digest").notNull(),
  codeDigest: text("code_digest").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  consumedAt: text("consumed_at"),
}, (table) => [
  index("discord_dm_challenges_discord_expires_idx").on(table.discordId, table.expiresAt),
  index("discord_dm_challenges_expires_at_idx").on(table.expiresAt),
  check(
    "discord_dm_challenges_attempts_check",
    sql`${table.attempts} >= 0 AND ${table.attempts} <= 5`,
  ),
]);

/**
 * Start throttles contain HMAC pseudonyms only. Raw CF IP addresses and raw
 * lookup identities are never written to this table.
 */
export const discordDmRateLimits = sqliteTable("discord_dm_rate_limits", {
  scope: text("scope").notNull(),
  subjectDigest: text("subject_digest").notNull(),
  windowStart: integer("window_start").notNull(),
  attempts: integer("attempts").notNull(),
  lastAttemptAt: integer("last_attempt_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.scope, table.subjectDigest] }),
  index("discord_dm_rate_limits_last_attempt_idx").on(table.lastAttemptAt),
  check("discord_dm_rate_limits_scope_check", sql`${table.scope} IN ('global', 'ip', 'discord')`),
  check("discord_dm_rate_limits_attempts_check", sql`${table.attempts} >= 1`),
]);

/**
 * Wallet challenges are persisted so they can be atomically consumed once.
 * The address and canonical origin are part of both this row and the signed
 * browser token, preventing substitution after the player has signed.
 */
export const walletChallenges = sqliteTable("wallet_challenges", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => authSessions.id, { onDelete: "cascade", onUpdate: "cascade" }),
  discordId: text("discord_id")
    .notNull()
    .references(() => players.discordId, { onDelete: "cascade", onUpdate: "cascade" }),
  address: text("address").notNull(),
  nonce: text("nonce").notNull(),
  origin: text("origin").notNull(),
  issuedAt: text("issued_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  consumedAt: text("consumed_at"),
}, (table) => [
  index("wallet_challenges_session_id_idx").on(table.sessionId),
  index("wallet_challenges_discord_id_idx").on(table.discordId),
  index("wallet_challenges_expires_at_idx").on(table.expiresAt),
]);

/**
 * Verified links between a Player Passport and an account in a partner game.
 *
 * Partner games are not required to know a Discord ID. OTOMO CHAIN 7, for
 * example, authenticates anonymously and exposes only a free-text, unverified
 * `external_id` field. A player proves control of that account by writing a
 * per-player link code into it; the code is derived from the Discord ID, so
 * reissuing is idempotent and nothing secret is stored here beyond the code.
 *
 * Both unique indexes exist to fail closed: one Discord ID owns at most one
 * code per game, and one game account can never resolve to two Passports.
 */
export const gameAccountLinks = sqliteTable("game_account_links", {
  gameId: text("game_id").notNull(),
  discordId: text("discord_id")
    .notNull()
    .references(() => players.discordId, { onDelete: "cascade", onUpdate: "cascade" }),
  linkCode: text("link_code").notNull(),
  issuedAt: text("issued_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  // Populated only once the code has been observed on the game side.
  gamePlayerId: text("game_player_id"),
  verifiedAt: text("verified_at"),
  verifiedSeasonId: text("verified_season_id"),
}, (table) => [
  primaryKey({ columns: [table.gameId, table.discordId] }),
  uniqueIndex("game_account_links_code_unique").on(table.gameId, table.linkCode),
  uniqueIndex("game_account_links_game_player_unique")
    .on(table.gameId, table.gamePlayerId)
    .where(sql`game_player_id IS NOT NULL`),
]);

export const pointGrants = sqliteTable("point_grants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  discordId: text("discord_id")
    .notNull()
    .references(() => players.discordId, { onDelete: "restrict", onUpdate: "cascade" }),
  amount: integer("amount").notNull(),
  // One append-only ledger carries every dashboard currency. SGP predates the
  // column, so it is the default; balances are always summed per currency.
  currency: text("currency").notNull().default("SGP"),
  reasonCode: text("reason_code").notNull(),
  note: text("note"),
  grantedBy: text("granted_by")
    .notNull()
    .references(() => players.discordId, { onDelete: "restrict", onUpdate: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  requestFingerprint: text("request_fingerprint").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("point_grants_discord_created_idx").on(table.discordId, table.createdAt),
  index("point_grants_granted_by_created_idx").on(table.grantedBy, table.createdAt),
]);

/**
 * Gacha pulls are append-only records of what a draw produced. The currency
 * debit lives in point_grants under the same idempotency key, so a retried
 * draw can neither double-charge nor double-award.
 */
export const gachaPulls = sqliteTable("gacha_pulls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  discordId: text("discord_id")
    .notNull()
    .references(() => players.discordId, { onDelete: "restrict", onUpdate: "cascade" }),
  poolId: text("pool_id").notNull(),
  cardId: text("card_id").notNull(),
  rarity: text("rarity").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("gacha_pulls_discord_created_idx").on(table.discordId, table.createdAt),
  index("gacha_pulls_discord_card_idx").on(table.discordId, table.cardId),
]);

export const auditEvents = sqliteTable("audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  subject: text("subject").notNull(),
  detail: text("detail"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("audit_events_actor_created_idx").on(table.actor, table.createdAt),
  index("audit_events_subject_created_idx").on(table.subject, table.createdAt),
]);
