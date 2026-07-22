import { and, desc, eq, gt, isNull, lt, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  auditEvents,
  authSessions,
  discordDmChallenges,
  discordDmRateLimits,
  players,
  pointGrants,
  walletChallenges,
} from "../db/schema";
import {
  OAUTH_SESSION_AUTHENTICATION,
  playerOsEnv,
  type AuthMethod,
  type AssuranceLevel,
  type PlayerOsEnv,
  type SessionClaims,
} from "./auth";

export { grantRequestFingerprint, isUniqueConstraintError } from "./auth";

const schema = {
  players,
  authSessions,
  discordDmChallenges,
  discordDmRateLimits,
  walletChallenges,
  pointGrants,
  auditEvents,
};

export function getDbFromEnv(bindings: PlayerOsEnv) {
  return bindings.DB ? drizzle(bindings.DB, { schema }) : null;
}

export async function getDb() {
  return getDbFromEnv(await playerOsEnv());
}

export type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type DiscordProfile = {
  id: string;
  username: string;
  globalName: string | null;
  avatarHash: string | null;
};

/** Creates/refreshes the player, durable session, and login audit atomically. */
export async function establishDiscordSession(
  db: Db,
  profile: DiscordProfile,
  session: {
    id: string;
    expiresAt: number;
    authMethod?: AuthMethod;
    assuranceLevel?: AssuranceLevel;
  },
) {
  const now = new Date().toISOString();
  const authMethod = session.authMethod ?? OAUTH_SESSION_AUTHENTICATION.authMethod;
  const assuranceLevel = session.assuranceLevel ?? OAUTH_SESSION_AUTHENTICATION.assuranceLevel;
  await db.batch([
    db
      .insert(players)
      .values({
        discordId: profile.id,
        discordUsername: profile.username,
        discordGlobalName: profile.globalName,
        discordAvatarHash: profile.avatarHash,
        createdAt: now,
        lastLoginAt: now,
      })
      .onConflictDoUpdate({
        target: players.discordId,
        set: {
          discordUsername: profile.username,
          discordGlobalName: profile.globalName,
          discordAvatarHash: profile.avatarHash,
          lastLoginAt: now,
        },
      }),
    db.insert(authSessions).values({
      id: session.id,
      discordId: profile.id,
      createdAt: now,
      expiresAt: session.expiresAt,
      authMethod,
      assuranceLevel,
    }),
    db.insert(auditEvents).values({
      actor: profile.id,
      action: "DISCORD_LOGIN",
      subject: profile.id,
      detail: JSON.stringify({
        sessionId: session.id.slice(0, 16),
        authMethod,
        assuranceLevel,
      }),
      createdAt: now,
    }),
  ]);
}

export type DiscordDmRateScope = "global" | "ip" | "discord";

/** Atomic cooldown and fixed-hour quota check; rejected attempts do not mutate. */
export async function consumeDiscordDmRateLimit(db: Db, input: {
  scope: DiscordDmRateScope;
  subjectDigest: string;
  nowSeconds: number;
  cooldownSeconds: number;
  windowSeconds: number;
  maxAttempts: number;
}): Promise<boolean> {
  const globalScope = input.scope === "global";
  if (
    !/^[0-9a-f]{64}$/.test(input.subjectDigest) ||
    !Number.isInteger(input.nowSeconds) ||
    !Number.isInteger(input.cooldownSeconds) ||
    input.cooldownSeconds < (globalScope ? 0 : 30) ||
    !Number.isInteger(input.windowSeconds) ||
    input.windowSeconds < input.cooldownSeconds ||
    input.windowSeconds > (globalScope ? 60 : 3_600) ||
    !Number.isInteger(input.maxAttempts) ||
    input.maxAttempts < 1 ||
    input.maxAttempts > (globalScope ? 30 : 5)
  ) {
    return false;
  }
  const windowCutoff = input.nowSeconds - input.windowSeconds;
  const cooldownCutoff = input.nowSeconds - input.cooldownSeconds;
  const rows = await db
    .insert(discordDmRateLimits)
    .values({
      scope: input.scope,
      subjectDigest: input.subjectDigest,
      windowStart: input.nowSeconds,
      attempts: 1,
      lastAttemptAt: input.nowSeconds,
    })
    .onConflictDoUpdate({
      target: [discordDmRateLimits.scope, discordDmRateLimits.subjectDigest],
      set: {
        windowStart: sql`CASE
          WHEN ${discordDmRateLimits.windowStart} <= ${windowCutoff} THEN ${input.nowSeconds}
          ELSE ${discordDmRateLimits.windowStart}
        END`,
        attempts: sql`CASE
          WHEN ${discordDmRateLimits.windowStart} <= ${windowCutoff} THEN 1
          ELSE ${discordDmRateLimits.attempts} + 1
        END`,
        lastAttemptAt: input.nowSeconds,
      },
      setWhere: and(
        lte(discordDmRateLimits.lastAttemptAt, cooldownCutoff),
        or(
          lte(discordDmRateLimits.windowStart, windowCutoff),
          lt(discordDmRateLimits.attempts, input.maxAttempts),
        ),
      ),
    })
    .returning({ attempts: discordDmRateLimits.attempts });
  return rows.length === 1;
}

export async function createDiscordDmChallenge(db: Db, input: {
  challengeIdDigest: string;
  discordId: string;
  clientNonceDigest: string;
  codeDigest: string;
  createdAt: string;
  expiresAt: number;
}) {
  const createdAtMs = Date.parse(input.createdAt);
  if (
    !/^[0-9a-f]{64}$/.test(input.challengeIdDigest) ||
    !/^\d{5,25}$/.test(input.discordId) ||
    !/^[0-9a-f]{64}$/.test(input.clientNonceDigest) ||
    !/^[0-9a-f]{64}$/.test(input.codeDigest) ||
    Number.isNaN(createdAtMs) ||
    !Number.isInteger(input.expiresAt) ||
    input.expiresAt <= Math.floor(createdAtMs / 1000) ||
    input.expiresAt - Math.floor(createdAtMs / 1000) > 300
  ) {
    throw new Error("Discord DM challenge is invalid");
  }
  await db.insert(discordDmChallenges).values(input);
}

export async function getPendingDiscordDmChallenge(db: Db, input: {
  challengeIdDigest: string;
  clientNonceDigest: string;
  nowSeconds: number;
}) {
  const rows = await db
    .select()
    .from(discordDmChallenges)
    .where(and(
      eq(discordDmChallenges.challengeIdDigest, input.challengeIdDigest),
      eq(discordDmChallenges.clientNonceDigest, input.clientNonceDigest),
      isNull(discordDmChallenges.consumedAt),
      gt(discordDmChallenges.expiresAt, input.nowSeconds),
      lt(discordDmChallenges.attempts, 5),
    ))
    .limit(1);
  return rows[0] ?? null;
}

/** Counts a wrong code once and terminally consumes the fifth failure. */
export async function recordDiscordDmChallengeFailure(db: Db, input: {
  challengeIdDigest: string;
  clientNonceDigest: string;
  nowSeconds: number;
  failedAt: string;
}): Promise<{ recorded: boolean; terminal: boolean; attempts: number }> {
  const rows = await db
    .update(discordDmChallenges)
    .set({
      attempts: sql`${discordDmChallenges.attempts} + 1`,
      consumedAt: sql`CASE
        WHEN ${discordDmChallenges.attempts} + 1 >= 5 THEN ${input.failedAt}
        ELSE NULL
      END`,
    })
    .where(and(
      eq(discordDmChallenges.challengeIdDigest, input.challengeIdDigest),
      eq(discordDmChallenges.clientNonceDigest, input.clientNonceDigest),
      isNull(discordDmChallenges.consumedAt),
      gt(discordDmChallenges.expiresAt, input.nowSeconds),
      lt(discordDmChallenges.attempts, 5),
    ))
    .returning({
      attempts: discordDmChallenges.attempts,
      consumedAt: discordDmChallenges.consumedAt,
    });
  const row = rows[0];
  return row
    ? { recorded: true, terminal: row.consumedAt !== null, attempts: row.attempts }
    : { recorded: false, terminal: true, attempts: 5 };
}

/** Atomic compare-and-set: a valid DM challenge establishes at most one session. */
export async function consumeDiscordDmChallenge(db: Db, input: {
  challengeIdDigest: string;
  clientNonceDigest: string;
  codeDigest: string;
  nowSeconds: number;
  consumedAt: string;
}): Promise<boolean> {
  const rows = await db
    .update(discordDmChallenges)
    .set({ consumedAt: input.consumedAt })
    .where(and(
      eq(discordDmChallenges.challengeIdDigest, input.challengeIdDigest),
      eq(discordDmChallenges.clientNonceDigest, input.clientNonceDigest),
      eq(discordDmChallenges.codeDigest, input.codeDigest),
      isNull(discordDmChallenges.consumedAt),
      gt(discordDmChallenges.expiresAt, input.nowSeconds),
      lt(discordDmChallenges.attempts, 5),
    ))
    .returning({ challengeIdDigest: discordDmChallenges.challengeIdDigest });
  return rows.length === 1;
}

export async function invalidateDiscordDmChallenge(db: Db, input: {
  challengeIdDigest: string;
  invalidatedAt: string;
}) {
  await db
    .update(discordDmChallenges)
    .set({ consumedAt: input.invalidatedAt })
    .where(and(
      eq(discordDmChallenges.challengeIdDigest, input.challengeIdDigest),
      isNull(discordDmChallenges.consumedAt),
    ));
}

export async function revokeSessionWithAudit(db: Db, session: SessionClaims) {
  const now = new Date().toISOString();
  await db.batch([
    db
      .update(authSessions)
      .set({ revokedAt: now })
      .where(and(eq(authSessions.id, session.sessionId), isNull(authSessions.revokedAt))),
    db.insert(auditEvents).values({
      actor: session.sub,
      action: "DISCORD_LOGOUT",
      subject: session.sub,
      detail: JSON.stringify({ sessionId: session.sessionId.slice(0, 16) }),
      createdAt: now,
    }),
  ]);
}

export async function createWalletChallenge(db: Db, challenge: {
  id: string;
  sessionId: string;
  discordId: string;
  address: string;
  nonce: string;
  origin: string;
  issuedAt: string;
  expiresAt: number;
}) {
  await db.insert(walletChallenges).values(challenge);
}

export async function getPendingWalletChallenge(
  db: Db,
  fields: { id: string; sessionId: string; discordId: string; address: string; nowSeconds: number },
) {
  const rows = await db
    .select()
    .from(walletChallenges)
    .where(and(
      eq(walletChallenges.id, fields.id),
      eq(walletChallenges.sessionId, fields.sessionId),
      eq(walletChallenges.discordId, fields.discordId),
      eq(walletChallenges.address, fields.address),
      isNull(walletChallenges.consumedAt),
      gt(walletChallenges.expiresAt, fields.nowSeconds),
    ))
    .limit(1);
  return rows[0] ?? null;
}

/** Atomic compare-and-set: exactly one concurrent verifier can consume it. */
export async function consumeWalletChallenge(
  db: Db,
  fields: { id: string; sessionId: string; discordId: string; address: string; nowSeconds: number },
): Promise<boolean> {
  const result = await db
    .update(walletChallenges)
    .set({ consumedAt: new Date().toISOString() })
    .where(and(
      eq(walletChallenges.id, fields.id),
      eq(walletChallenges.sessionId, fields.sessionId),
      eq(walletChallenges.discordId, fields.discordId),
      eq(walletChallenges.address, fields.address),
      isNull(walletChallenges.consumedAt),
      gt(walletChallenges.expiresAt, fields.nowSeconds),
    ));
  return Number(result.meta.changes ?? 0) === 1;
}

export async function linkWalletWithAudit(db: Db, input: {
  session: SessionClaims;
  address: string;
  previousAddress: string | null;
  linkedAt: string;
}) {
  await db.batch([
    db
      .update(players)
      .set({ walletAddress: input.address, walletLinkedAt: input.linkedAt })
      .where(eq(players.discordId, input.session.sub)),
    db.insert(auditEvents).values({
      actor: input.session.sub,
      action: "WALLET_LINK",
      subject: input.address,
      detail: JSON.stringify({ previous: input.previousAddress }),
      createdAt: input.linkedAt,
    }),
  ]);
}

export async function unlinkWalletWithAudit(db: Db, input: {
  session: SessionClaims;
  previousAddress: string;
}) {
  const now = new Date().toISOString();
  await db.batch([
    db
      .update(players)
      .set({ walletAddress: null, walletLinkedAt: null })
      .where(eq(players.discordId, input.session.sub)),
    db.insert(auditEvents).values({
      actor: input.session.sub,
      action: "WALLET_UNLINK",
      subject: input.previousAddress,
      createdAt: now,
    }),
  ]);
}

/** Persists a successful guild sync snapshot. Failed syncs never call this. */
export async function updateGuildMembership(db: Db, input: {
  discordId: string;
  member: boolean;
  joinedAt: string | null;
  roles: string[];
  syncedAt: string;
}) {
  await db
    .update(players)
    .set({
      guildMember: input.member ? 1 : 0,
      guildJoinedAt: input.joinedAt,
      guildRoles: JSON.stringify(input.roles),
      guildSyncedAt: input.syncedAt,
    })
    .where(eq(players.discordId, input.discordId));
}

/**
 * The integration actor is the service's own Discord bot user. The ledger's
 * granted_by column requires an existing player row, so the actor is
 * registered once, idempotently, before its first automated grant.
 */
export async function ensureIntegrationActor(db: Db, actorId: string) {
  await db
    .insert(players)
    .values({
      discordId: actorId,
      discordUsername: "sgg-integration-service",
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: players.discordId });
}

export async function getPlayer(db: Db, discordId: string) {
  const rows = await db.select().from(players).where(eq(players.discordId, discordId)).limit(1);
  return rows[0] ?? null;
}

export async function getPointBalance(db: Db, discordId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`COALESCE(SUM(${pointGrants.amount}), 0)` })
    .from(pointGrants)
    .where(eq(pointGrants.discordId, discordId));
  return rows[0]?.total ?? 0;
}

export async function getRecentGrants(db: Db, discordId: string, limit = 20) {
  return db
    .select({
      amount: pointGrants.amount,
      reasonCode: pointGrants.reasonCode,
      note: pointGrants.note,
      createdAt: pointGrants.createdAt,
    })
    .from(pointGrants)
    .where(eq(pointGrants.discordId, discordId))
    .orderBy(desc(pointGrants.id))
    .limit(limit);
}

export async function getGrantByIdempotencyKey(db: Db, idempotencyKey: string) {
  const rows = await db
    .select({
      discordId: pointGrants.discordId,
      amount: pointGrants.amount,
      reasonCode: pointGrants.reasonCode,
      note: pointGrants.note,
      grantedBy: pointGrants.grantedBy,
      requestFingerprint: pointGrants.requestFingerprint,
    })
    .from(pointGrants)
    .where(eq(pointGrants.idempotencyKey, idempotencyKey))
    .limit(1);
  return rows[0] ?? null;
}

export async function appendPointGrantWithAudit(db: Db, input: {
  discordId: string;
  amount: number;
  reasonCode: string;
  note: string | null;
  grantedBy: string;
  idempotencyKey: string;
  requestFingerprint: string;
}) {
  const now = new Date().toISOString();
  await db.batch([
    db.insert(pointGrants).values({ ...input, createdAt: now }),
    db.insert(auditEvents).values({
      actor: input.grantedBy,
      action: "POINTS_GRANT",
      subject: input.discordId,
      detail: JSON.stringify({
        amount: input.amount,
        reasonCode: input.reasonCode,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.requestFingerprint,
      }),
      createdAt: now,
    }),
  ]);
}
