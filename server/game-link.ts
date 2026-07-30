/**
 * Player Passport <-> partner game account linking.
 *
 * Partner games are not required to implement Discord login. OTOMO CHAIN 7
 * authenticates anonymously (install-bound bearer tokens) and offers only a
 * free-text `external_id` profile field that it explicitly labels unverified.
 * Trusting that field directly would let anyone claim another player's points,
 * so the trust flows the other way: this dashboard, which already holds a
 * verified Discord identity, issues a code that the player writes into the
 * game. Observing the code on the game side then proves account control.
 *
 * The code is an HMAC of the Discord ID rather than a random value, so issuing
 * is idempotent and a player can reopen the page and see the same code.
 */

import { eq, and } from "drizzle-orm";

import { gameAccountLinks } from "../db/schema";
import type { Db } from "./passport-db";

export const OTOMO_CHAIN_GAME_ID = "otomo-chain-7";

/** Crockford base32 without I, L, O, U so codes survive being read aloud. */
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_BODY_LENGTH = 8;
const LINK_CODE_DOMAIN = "SGG_GAME_ACCOUNT_LINK_V1";

const encoder = new TextEncoder();

export type GameLink = {
  gameId: string;
  discordId: string;
  linkCode: string;
  issuedAt: string;
  gamePlayerId: string | null;
  verifiedAt: string | null;
  verifiedSeasonId: string | null;
};

/**
 * Derives the player's code. Purpose-domained so the same session secret
 * cannot produce a value that is also valid as an auth token.
 */
export async function deriveLinkCode(
  sessionSecret: string,
  gameId: string,
  discordId: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${LINK_CODE_DOMAIN}:${gameId}:${discordId}`),
  );

  const bytes = new Uint8Array(signature);
  let body = "";
  for (let index = 0; index < CODE_BODY_LENGTH; index += 1) {
    body += CODE_ALPHABET[bytes[index] % CODE_ALPHABET.length];
  }
  return `SGG-${body.slice(0, 4)}-${body.slice(4)}`;
}

/**
 * Accepts what a player actually types. The game field is free text and many
 * players will write something like "zm6509 / SGG-7K2M-4XQ1", so the code is
 * matched as a substring after normalising case and separators.
 */
export function findLinkCodeIn(externalId: string | null | undefined): string | null {
  if (typeof externalId !== "string") return null;
  const normalized = externalId.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const match = normalized.match(
    new RegExp(`SGG([${CODE_ALPHABET}]{${CODE_BODY_LENGTH}})`),
  );
  if (!match) return null;
  const body = match[1];
  return `SGG-${body.slice(0, 4)}-${body.slice(4)}`;
}

export type ReconcileCandidate = {
  gamePlayerId: string;
  externalId: string | null;
};

export type ReconcileOutcome = {
  /** Codes matched to exactly one game account and one Passport. */
  matched: { linkCode: string; discordId: string; gamePlayerId: string }[];
  /** One code found on several game accounts: unresolvable without a human. */
  ambiguous: { linkCode: string; gamePlayerIds: string[] }[];
  /** A well-formed code that no Passport ever had issued to it. */
  unknownCodes: { linkCode: string; gamePlayerId: string }[];
  /** Game accounts carrying no recognisable code; simply not participating in the link. */
  unlinked: number;
};

/**
 * Decides which game accounts may bind to which Passports. Pure: it reads the
 * issued codes and the game's export and returns a plan, so the same inputs
 * can be shown as a dry run before anything is written.
 *
 * Ambiguity is never resolved by picking a winner. If one code appears on two
 * game accounts, both are withheld for manual review — awarding the wrong
 * player is worse than awarding nobody.
 */
export function planReconciliation(
  issued: { linkCode: string; discordId: string }[],
  candidates: ReconcileCandidate[],
): ReconcileOutcome {
  const codeToDiscordId = new Map(issued.map((row) => [row.linkCode, row.discordId]));
  const codeToGameAccounts = new Map<string, string[]>();
  let unlinked = 0;

  for (const candidate of candidates) {
    const linkCode = findLinkCodeIn(candidate.externalId);
    if (!linkCode) {
      unlinked += 1;
      continue;
    }
    const accounts = codeToGameAccounts.get(linkCode) ?? [];
    if (!accounts.includes(candidate.gamePlayerId)) accounts.push(candidate.gamePlayerId);
    codeToGameAccounts.set(linkCode, accounts);
  }

  const outcome: ReconcileOutcome = {
    matched: [],
    ambiguous: [],
    unknownCodes: [],
    unlinked,
  };

  for (const [linkCode, gamePlayerIds] of codeToGameAccounts) {
    if (gamePlayerIds.length > 1) {
      outcome.ambiguous.push({ linkCode, gamePlayerIds });
      continue;
    }
    const discordId = codeToDiscordId.get(linkCode);
    if (!discordId) {
      outcome.unknownCodes.push({ linkCode, gamePlayerId: gamePlayerIds[0] });
      continue;
    }
    outcome.matched.push({ linkCode, discordId, gamePlayerId: gamePlayerIds[0] });
  }

  return outcome;
}

export async function listIssuedLinks(db: Db, gameId: string) {
  return db
    .select({
      linkCode: gameAccountLinks.linkCode,
      discordId: gameAccountLinks.discordId,
      gamePlayerId: gameAccountLinks.gamePlayerId,
    })
    .from(gameAccountLinks)
    .where(eq(gameAccountLinks.gameId, gameId));
}

/**
 * Records one confirmed binding. The unique index on (game_id, game_player_id)
 * is the real guarantee: a second Passport claiming the same game account
 * raises instead of overwriting.
 */
export async function confirmGameLink(db: Db, input: {
  gameId: string;
  discordId: string;
  gamePlayerId: string;
  seasonId: string;
}) {
  await db
    .update(gameAccountLinks)
    .set({
      gamePlayerId: input.gamePlayerId,
      verifiedAt: new Date().toISOString(),
      verifiedSeasonId: input.seasonId,
    })
    .where(and(
      eq(gameAccountLinks.gameId, input.gameId),
      eq(gameAccountLinks.discordId, input.discordId),
    ));
}

export type IdentityResolution = {
  gamePlayerId: string;
  discordId: string;
  /** Where the identity came from, strongest first. */
  source: "RECORD_DISCORD" | "PRE_ENTRY" | "CONFIRMED_LINK" | "LINK_CODE";
};

/**
 * Resolves game accounts to Discord IDs using every trustworthy source, in
 * strength order. Ambiguous link codes never resolve; a stronger source for
 * the same account always wins over a weaker one.
 */
export function resolveIdentities(input: {
  records: { gamePlayerId: string; recordDiscordId: string | null; externalId: string | null }[];
  preEntries: { gamePlayerId: string; discordId: string | null }[];
  issuedLinks: { linkCode: string; discordId: string; gamePlayerId: string | null }[];
}): Map<string, IdentityResolution> {
  const out = new Map<string, IdentityResolution>();
  const preEntryByPlayer = new Map(
    input.preEntries.filter((e) => e.discordId).map((e) => [e.gamePlayerId, e.discordId as string]),
  );
  const confirmedByPlayer = new Map(
    input.issuedLinks.filter((l) => l.gamePlayerId).map((l) => [l.gamePlayerId as string, l.discordId]),
  );

  // 第1パス: 強いソース。ここで確定した行は第2パスのコード照合から外す。
  // 強い身元を持つ人のプロフィールに残った連携コードが、他人のコード解決を
  // 「曖昧」として道連れにしないため。
  for (const record of input.records) {
    const id = record.gamePlayerId;
    if (record.recordDiscordId) {
      out.set(id, { gamePlayerId: id, discordId: record.recordDiscordId, source: "RECORD_DISCORD" });
    } else if (preEntryByPlayer.has(id)) {
      out.set(id, { gamePlayerId: id, discordId: preEntryByPlayer.get(id) as string, source: "PRE_ENTRY" });
    } else if (confirmedByPlayer.has(id)) {
      out.set(id, { gamePlayerId: id, discordId: confirmedByPlayer.get(id) as string, source: "CONFIRMED_LINK" });
    }
  }

  // 第2パス: 未解決の行だけでコード照合。曖昧さの判定も未解決集合の中で行う。
  const unresolved = input.records.filter((r) => !out.has(r.gamePlayerId));
  const codePlan = planReconciliation(
    input.issuedLinks.map((l) => ({ linkCode: l.linkCode, discordId: l.discordId })),
    unresolved.map((r) => ({ gamePlayerId: r.gamePlayerId, externalId: r.externalId })),
  );
  for (const match of codePlan.matched) {
    out.set(match.gamePlayerId, {
      gamePlayerId: match.gamePlayerId,
      discordId: match.discordId,
      source: "LINK_CODE",
    });
  }
  return out;
}

export async function getGameLink(
  db: Db,
  gameId: string,
  discordId: string,
): Promise<GameLink | null> {
  const rows = await db
    .select()
    .from(gameAccountLinks)
    .where(and(eq(gameAccountLinks.gameId, gameId), eq(gameAccountLinks.discordId, discordId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Returns the player's link, creating the row on first request. The code is
 * derived, so a lost row simply regenerates the same value and any code the
 * player already wrote into the game stays valid.
 */
export async function ensureGameLink(db: Db, input: {
  sessionSecret: string;
  gameId: string;
  discordId: string;
}): Promise<GameLink> {
  const existing = await getGameLink(db, input.gameId, input.discordId);
  if (existing) return existing;

  const linkCode = await deriveLinkCode(input.sessionSecret, input.gameId, input.discordId);
  await db
    .insert(gameAccountLinks)
    .values({ gameId: input.gameId, discordId: input.discordId, linkCode })
    .onConflictDoNothing();

  const created = await getGameLink(db, input.gameId, input.discordId);
  if (!created) throw new Error("game link row could not be created");
  return created;
}
