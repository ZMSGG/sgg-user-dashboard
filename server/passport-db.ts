import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  auditEvents,
  authSessions,
  players,
  pointGrants,
  walletChallenges,
} from "../db/schema";
import { playerOsEnv, type SessionClaims } from "./auth";

export { grantRequestFingerprint, isUniqueConstraintError } from "./auth";

const schema = { players, authSessions, walletChallenges, pointGrants, auditEvents };

export async function getDb() {
  const bindings = await playerOsEnv();
  if (!bindings.DB) return null;
  return drizzle(bindings.DB, { schema });
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
  session: { id: string; expiresAt: number },
) {
  const now = new Date().toISOString();
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
    }),
    db.insert(auditEvents).values({
      actor: profile.id,
      action: "DISCORD_LOGIN",
      subject: profile.id,
      detail: JSON.stringify({ sessionId: session.id.slice(0, 16) }),
      createdAt: now,
    }),
  ]);
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
