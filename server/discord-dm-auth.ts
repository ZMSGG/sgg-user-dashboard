/**
 * Low-assurance Discord Bot DM authentication.
 *
 * The bot only DMs an exact, freshly verified guild member. Browser-visible
 * challenge material is stored as a digest, OTP/IP rate material uses a
 * dedicated pepper, and a successful code is atomically consumed before a
 * revocable low-assurance session is established.
 */

import type { PlayerOsEnv } from "./auth";
import {
  DM_SESSION_AUTHENTICATION,
  DM_SESSION_TTL_SECONDS,
  SESSION_COOKIE,
  createSessionArtifact,
  cookieHeader,
  hasJsonRequestHeader,
  isSecureRequest,
  isStrongSessionSecret,
  jsonError,
  randomToken,
  readCookie,
  resolveAppOrigin,
  sha256Hex,
} from "./auth";
import {
  consumeDiscordDmChallenge,
  consumeDiscordDmRateLimit,
  createDiscordDmChallenge,
  establishDiscordSession,
  getDbFromEnv,
  getPendingDiscordDmChallenge,
  invalidateDiscordDmChallenge,
  recordDiscordDmChallengeFailure,
  updateGuildMembership,
} from "./passport-db";

export const DM_CHALLENGE_COOKIE = "sgg_dm_challenge";
export const DM_CODE_TTL_SECONDS = 5 * 60;
export const DM_CODE_LENGTH = 10;
export const DM_MAX_CODE_ATTEMPTS = 5;
export const DM_START_COOLDOWN_SECONDS = 30;
export const DM_START_WINDOW_SECONDS = 60 * 60;
export const DM_START_MAX_ATTEMPTS = 5;
export const DM_GLOBAL_START_WINDOW_SECONDS = 60;
export const DM_GLOBAL_START_MAX_ATTEMPTS = 30;

const DISCORD_API = "https://discord.com/api/v10";
const DISCORD_ID_PATTERN = /^\d{5,25}$/;
const CHALLENGE_ID_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const CLIENT_NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const USERNAME_PATTERN = /^[A-Za-z0-9._]{2,32}$/;
const MAX_JSON_BODY_LENGTH = 1_024;
const MAX_DISCORD_JSON_LENGTH = 128 * 1_024;
const encoder = new TextEncoder();

export type DiscordDmAuthConfig = {
  db: D1Database;
  sessionSecret: string;
  botToken: string;
  guildId: string;
  otpPepper: string;
};

export type DiscordDmMember = {
  id: string;
  username: string;
  globalName: string | null;
  avatarHash: string | null;
  joinedAt: string | null;
  roles: string[];
};

type DiscordFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type DmHandlerDependencies = {
  fetcher?: DiscordFetch;
  nowSeconds?: number;
  timeoutMs?: number;
  /** Required for start: production binds this to Cloudflare waitUntil. */
  schedule?: (task: Promise<void>) => void;
};

type DiscordIdentity =
  | { kind: "id"; value: string }
  | { kind: "username"; value: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function discordDmAuthConfigFromEnv(env: PlayerOsEnv): DiscordDmAuthConfig | null {
  if (
    !env.DB ||
    !isStrongSessionSecret(env.SESSION_SECRET) ||
    typeof env.DISCORD_BOT_TOKEN !== "string" ||
    env.DISCORD_BOT_TOKEN !== env.DISCORD_BOT_TOKEN.trim() ||
    env.DISCORD_BOT_TOKEN.length < 32 ||
    typeof env.DISCORD_GUILD_ID !== "string" ||
    !DISCORD_ID_PATTERN.test(env.DISCORD_GUILD_ID) ||
    !isStrongSessionSecret(env.DM_OTP_PEPPER) ||
    env.DM_OTP_PEPPER === env.SESSION_SECRET
  ) {
    return null;
  }
  if ([
    env.DISCORD_BOT_TOKEN,
    env.DISCORD_CLIENT_SECRET,
    env.INTEGRATION_GRANT_SECRET,
  ].some((secret) => typeof secret === "string" && secret === env.DM_OTP_PEPPER)) {
    return null;
  }
  return {
    db: env.DB,
    sessionSecret: env.SESSION_SECRET,
    botToken: env.DISCORD_BOT_TOKEN,
    guildId: env.DISCORD_GUILD_ID,
    otpPepper: env.DM_OTP_PEPPER,
  };
}

export function normalizeDiscordIdentity(value: unknown): DiscordIdentity | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (DISCORD_ID_PATTERN.test(trimmed)) return { kind: "id", value: trimmed };
  const username = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  return USERNAME_PATTERN.test(username)
    ? { kind: "username", value: username }
    : null;
}

export function normalizeCfConnectingIp(value: unknown): string | null {
  if (typeof value !== "string" || value !== value.trim() || value.length > 64) return null;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    const octets = value.split(".").map(Number);
    return octets.every((octet) => octet >= 0 && octet <= 255)
      ? octets.join(".")
      : null;
  }
  const lowered = value.toLowerCase();
  if (
    !lowered.includes(":") ||
    !/^[0-9a-f:]+$/.test(lowered) ||
    lowered.includes(":::") ||
    (lowered.match(/::/g)?.length ?? 0) > 1
  ) {
    return null;
  }
  const parts = lowered.split(":");
  if (parts.some((part) => part.length > 4)) return null;
  const nonEmpty = parts.filter(Boolean);
  if (lowered.includes("::")) {
    if (nonEmpty.length >= 8) return null;
  } else if (parts.length !== 8 || nonEmpty.length !== 8) {
    return null;
  }
  return lowered;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function domainHmacHex(
  pepper: string,
  domain: string,
  ...parts: string[]
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const framed = [domain, ...parts]
    .map((part) => `${encoder.encode(part).byteLength}:${part}`)
    .join("\u0000");
  return bytesToHex(new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(framed)),
  ));
}

export async function discordDmCodeDigest(
  pepper: string,
  challengeIdDigest: string,
  discordId: string,
  code: string,
): Promise<string> {
  return domainHmacHex(
    pepper,
    "SGG_DISCORD_DM_OTP_CODE_V1",
    challengeIdDigest,
    discordId,
    code,
  );
}

export async function discordDmRateSubjectDigest(
  pepper: string,
  scope: "global" | "ip" | "discord",
  value: string,
): Promise<string> {
  return domainHmacHex(pepper, `SGG_DISCORD_DM_RATE_${scope.toUpperCase()}_V1`, value);
}

function equalHex(left: string, right: string): boolean {
  if (left.length !== right.length || !/^[0-9a-f]+$/.test(left + right)) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function generateDiscordDmCode(): string {
  const bytes = new Uint8Array(DM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  // The canonical Crockford alphabet has exactly 32 symbols, so masking five
  // random bits is unbiased. I/L/O/U are never generated.
  for (const byte of bytes) code += CROCKFORD_ALPHABET[byte & 31];
  return code;
}

function parseDiscordMember(payload: unknown, expectedId?: string): DiscordDmMember | null {
  if (!isObject(payload) || !isObject(payload.user) || !Array.isArray(payload.roles)) return null;
  const user = payload.user;
  if (
    typeof user.id !== "string" ||
    !DISCORD_ID_PATTERN.test(user.id) ||
    (expectedId !== undefined && user.id !== expectedId) ||
    typeof user.username !== "string" ||
    user.username.length < 2 ||
    user.username.length > 32 ||
    /[\u0000-\u001f\u007f]/.test(user.username) ||
    user.bot === true ||
    (user.bot !== undefined && typeof user.bot !== "boolean") ||
    payload.roles.length > 250 ||
    !payload.roles.every((role) => typeof role === "string" && DISCORD_ID_PATTERN.test(role)) ||
    new Set(payload.roles).size !== payload.roles.length
  ) {
    return null;
  }
  if (
    payload.joined_at !== null &&
    (typeof payload.joined_at !== "string" || Number.isNaN(Date.parse(payload.joined_at)))
  ) {
    return null;
  }
  if (
    user.global_name !== undefined &&
    user.global_name !== null &&
    (typeof user.global_name !== "string" ||
      user.global_name.length > 100 ||
      /[\u0000-\u001f\u007f]/.test(user.global_name))
  ) {
    return null;
  }
  if (
    user.avatar !== undefined &&
    user.avatar !== null &&
    (typeof user.avatar !== "string" || !/^[A-Za-z0-9_]+$/.test(user.avatar))
  ) {
    return null;
  }
  return {
    id: user.id,
    username: user.username,
    globalName: typeof user.global_name === "string" ? user.global_name : null,
    avatarHash: typeof user.avatar === "string" ? user.avatar : null,
    joinedAt: payload.joined_at,
    roles: payload.roles,
  };
}

async function readDiscordJson(response: Response): Promise<unknown | null> {
  if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return null;
  }
  try {
    const text = await response.text();
    if (!text || text.length > MAX_DISCORD_JSON_LENGTH) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function discordRequestInit(config: DiscordDmAuthConfig, timeoutMs: number): RequestInit {
  return {
    headers: { authorization: `Bot ${config.botToken}` },
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  };
}

/** Exact guild-member lookup; malformed, missing, and ambiguous data fail closed. */
export async function findDiscordDmGuildMember(
  config: DiscordDmAuthConfig,
  identity: DiscordIdentity,
  fetcher: DiscordFetch = fetch,
  timeoutMs = 8_000,
): Promise<DiscordDmMember | null> {
  try {
    if (identity.kind === "id") {
      const response = await fetcher(
        `${DISCORD_API}/guilds/${config.guildId}/members/${identity.value}`,
        discordRequestInit(config, timeoutMs),
      );
      if (response.status !== 200) return null;
      return parseDiscordMember(await readDiscordJson(response), identity.value);
    }

    const url = new URL(`${DISCORD_API}/guilds/${config.guildId}/members/search`);
    url.searchParams.set("query", identity.value);
    url.searchParams.set("limit", "100");
    const response = await fetcher(url, discordRequestInit(config, timeoutMs));
    if (response.status !== 200) return null;
    const payload = await readDiscordJson(response);
    if (!Array.isArray(payload) || payload.length > 100) return null;

    const parsed: DiscordDmMember[] = [];
    for (const item of payload) {
      const member = parseDiscordMember(item);
      if (!member) return null;
      parsed.push(member);
    }
    const expected = identity.value.toLowerCase();
    const exact = new Map(
      parsed
        .filter((member) => member.username.toLowerCase() === expected)
        .map((member) => [member.id, member]),
    );
    return exact.size === 1 ? [...exact.values()][0] : null;
  } catch {
    return null;
  }
}

/** Sends the code only after exact guild membership has already been proven. */
export async function sendDiscordDmCode(
  config: DiscordDmAuthConfig,
  member: DiscordDmMember,
  code: string,
  fetcher: DiscordFetch = fetch,
  timeoutMs = 8_000,
): Promise<boolean> {
  if (!DISCORD_ID_PATTERN.test(member.id) || !new RegExp(`^[${CROCKFORD_ALPHABET}]{${DM_CODE_LENGTH}}$`).test(code)) {
    return false;
  }
  try {
    const channelResponse = await fetcher(`${DISCORD_API}/users/@me/channels`, {
      ...discordRequestInit(config, timeoutMs),
      method: "POST",
      headers: {
        authorization: `Bot ${config.botToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ recipient_id: member.id }),
    });
    if (channelResponse.status !== 200) return false;
    const channel = await readDiscordJson(channelResponse);
    if (!isObject(channel) || typeof channel.id !== "string" || !DISCORD_ID_PATTERN.test(channel.id)) {
      return false;
    }

    const messageResponse = await fetcher(`${DISCORD_API}/channels/${channel.id}/messages`, {
      ...discordRequestInit(config, timeoutMs),
      method: "POST",
      headers: {
        authorization: `Bot ${config.botToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        content: [
          "MY SGG ログイン認証コード",
          `**${code}**`,
          "5分以内に入力してください。このコードを他の人に共有しないでください。",
        ].join("\n"),
      }),
    });
    if (messageResponse.status !== 200) return false;
    const message = await readDiscordJson(messageResponse);
    return isObject(message) &&
      typeof message.id === "string" &&
      DISCORD_ID_PATTERN.test(message.id) &&
      message.channel_id === channel.id;
  } catch {
    return false;
  }
}

function dmChallengeCookie(value: string, maxAge: number, secure: boolean): string {
  return [
    `${DM_CHALLENGE_COOKIE}=${value}`,
    "Path=/api/auth/discord/dm",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

function clearDmChallengeCookie(secure: boolean): string {
  return dmChallengeCookie("", 0, secure);
}

function isSameOriginJsonRequest(request: Request, configuredOrigin: unknown): boolean {
  if (!hasJsonRequestHeader(request)) return false;
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return false;
  const resolvedOrigin = resolveAppOrigin(request, configuredOrigin);
  return resolvedOrigin !== null && request.headers.get("origin") === resolvedOrigin;
}

async function readSmallJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const declaredLength = request.headers.get("content-length");
    if (
      declaredLength !== null &&
      (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_JSON_BODY_LENGTH)
    ) {
      return null;
    }
    if (!request.body) return null;
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let total = 0;
    let text = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_JSON_BODY_LENGTH) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    if (!text) return null;
    const parsed = JSON.parse(text) as unknown;
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function acceptedStartResponse(challengeId: string, clientNonce: string, secure: boolean): Response {
  return Response.json(
    { ok: true, challengeId, expiresIn: DM_CODE_TTL_SECONDS },
    {
      status: 202,
      headers: {
        "Cache-Control": "no-store",
        "set-cookie": dmChallengeCookie(clientNonce, DM_CODE_TTL_SECONDS, secure),
      },
    },
  );
}

function verifyFailureResponse(secure: boolean, terminal: boolean, status = 400): Response {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (terminal) headers.append("set-cookie", clearDmChallengeCookie(secure));
  return Response.json(
    {
      ok: false,
      code: "DM_AUTH_FAILED",
      message: "認証コードを確認できませんでした。もう一度お試しください。",
    },
    { status, headers },
  );
}

type DiscordDmDb = NonNullable<ReturnType<typeof getDbFromEnv>>;

/**
 * All membership-dependent work runs under the route's Cloudflare waitUntil
 * promise. The public start response never waits on Discord or D1, so guild
 * membership cannot be inferred from request duration.
 */
async function performDiscordDmStart(input: {
  config: DiscordDmAuthConfig;
  db: DiscordDmDb;
  identity: DiscordIdentity;
  ip: string;
  nowSeconds: number;
  timeoutMs: number;
  fetcher: DiscordFetch;
  challengeId: string;
  clientNonce: string;
}): Promise<void> {
  try {
    const ipDigest = await discordDmRateSubjectDigest(input.config.otpPepper, "ip", input.ip);
    const ipAllowed = await consumeDiscordDmRateLimit(input.db, {
      scope: "ip",
      subjectDigest: ipDigest,
      nowSeconds: input.nowSeconds,
      cooldownSeconds: DM_START_COOLDOWN_SECONDS,
      windowSeconds: DM_START_WINDOW_SECONDS,
      maxAttempts: DM_START_MAX_ATTEMPTS,
    });
    if (!ipAllowed) return;

    // Count only requests that passed the source-IP quota. This prevents one
    // IP from deliberately exhausting the global breaker for every player.
    const globalDigest = await discordDmRateSubjectDigest(
      input.config.otpPepper,
      "global",
      "discord-dm-start",
    );
    const globallyAllowed = await consumeDiscordDmRateLimit(input.db, {
      scope: "global",
      subjectDigest: globalDigest,
      nowSeconds: input.nowSeconds,
      cooldownSeconds: 0,
      windowSeconds: DM_GLOBAL_START_WINDOW_SECONDS,
      maxAttempts: DM_GLOBAL_START_MAX_ATTEMPTS,
    });
    if (!globallyAllowed) return;

    const member = await findDiscordDmGuildMember(
      input.config,
      input.identity,
      input.fetcher,
      input.timeoutMs,
    );
    if (!member) return;
    const discordDigest = await discordDmRateSubjectDigest(
      input.config.otpPepper,
      "discord",
      member.id,
    );
    const discordAllowed = await consumeDiscordDmRateLimit(input.db, {
      scope: "discord",
      subjectDigest: discordDigest,
      nowSeconds: input.nowSeconds,
      cooldownSeconds: DM_START_COOLDOWN_SECONDS,
      windowSeconds: DM_START_WINDOW_SECONDS,
      maxAttempts: DM_START_MAX_ATTEMPTS,
    });
    if (!discordAllowed) return;

    const challengeIdDigest = await sha256Hex(input.challengeId);
    const clientNonceDigest = await sha256Hex(input.clientNonce);
    const code = generateDiscordDmCode();
    const codeDigest = await discordDmCodeDigest(
      input.config.otpPepper,
      challengeIdDigest,
      member.id,
      code,
    );
    const timestamp = new Date(input.nowSeconds * 1000).toISOString();
    await createDiscordDmChallenge(input.db, {
      challengeIdDigest,
      discordId: member.id,
      clientNonceDigest,
      codeDigest,
      createdAt: timestamp,
      expiresAt: input.nowSeconds + DM_CODE_TTL_SECONDS,
    });
    const sent = await sendDiscordDmCode(
      input.config,
      member,
      code,
      input.fetcher,
      input.timeoutMs,
    );
    if (!sent) {
      await invalidateDiscordDmChallenge(input.db, {
        challengeIdDigest,
        invalidatedAt: timestamp,
      });
    }
  } catch {
    // Delivery, lookup, storage, and throttling failures are indistinguishable.
  }
}

export async function handleDiscordDmStart(
  request: Request,
  env: PlayerOsEnv,
  dependencies: DmHandlerDependencies = {},
): Promise<Response> {
  if (!isSameOriginJsonRequest(request, env.APP_ORIGIN)) {
    return jsonError(403, "DM_AUTH_FAILED", "認証を開始できませんでした。");
  }
  const config = discordDmAuthConfigFromEnv(env);
  const db = getDbFromEnv(env);
  if (!config || !db || typeof dependencies.schedule !== "function") {
    return jsonError(503, "DM_AUTH_UNAVAILABLE", "Discord認証は現在準備中です。");
  }

  const secure = isSecureRequest(request);
  const nowSeconds = dependencies.nowSeconds ?? Math.floor(Date.now() / 1000);
  const timeoutMs = dependencies.timeoutMs ?? 8_000;
  const fetcher = dependencies.fetcher ?? fetch;
  const challengeId = randomToken(24);
  const clientNonce = randomToken(32);
  const body = await readSmallJson(request);
  const identity = normalizeDiscordIdentity(body?.identity);
  const ip = normalizeCfConnectingIp(request.headers.get("cf-connecting-ip"));
  if (identity && ip && Number.isInteger(nowSeconds)) {
    // A gate prevents any background work from starting until waitUntil has
    // accepted the promise. If scheduling fails, the endpoint fails closed.
    const gate: { release?: () => void } = {};
    const scheduled = new Promise<void>((resolve) => { gate.release = resolve; })
      .then(() => performDiscordDmStart({
        config,
        db,
        identity,
        ip,
        nowSeconds,
        timeoutMs,
        fetcher,
        challengeId,
        clientNonce,
      }));
    try {
      dependencies.schedule(scheduled);
      gate.release?.();
    } catch {
      return jsonError(503, "DM_AUTH_UNAVAILABLE", "Discord認証は現在準備中です。");
    }
  }
  return acceptedStartResponse(challengeId, clientNonce, secure);
}

export async function handleDiscordDmVerify(
  request: Request,
  env: PlayerOsEnv,
  dependencies: DmHandlerDependencies = {},
): Promise<Response> {
  const secure = isSecureRequest(request);
  if (!isSameOriginJsonRequest(request, env.APP_ORIGIN)) {
    return verifyFailureResponse(secure, true, 403);
  }
  const config = discordDmAuthConfigFromEnv(env);
  const db = getDbFromEnv(env);
  if (!config || !db) {
    return verifyFailureResponse(secure, true, 503);
  }

  const nowSeconds = dependencies.nowSeconds ?? Math.floor(Date.now() / 1000);
  const timeoutMs = dependencies.timeoutMs ?? 8_000;
  const fetcher = dependencies.fetcher ?? fetch;
  const body = await readSmallJson(request);
  const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const clientNonce = readCookie(request, DM_CHALLENGE_COOKIE) ?? "";
  if (
    !CHALLENGE_ID_PATTERN.test(challengeId) ||
    !new RegExp(`^[${CROCKFORD_ALPHABET}]{${DM_CODE_LENGTH}}$`).test(code) ||
    !CLIENT_NONCE_PATTERN.test(clientNonce) ||
    !Number.isInteger(nowSeconds)
  ) {
    return verifyFailureResponse(secure, true);
  }

  const challengeIdDigest = await sha256Hex(challengeId);
  const clientNonceDigest = await sha256Hex(clientNonce);
  let challenge: Awaited<ReturnType<typeof getPendingDiscordDmChallenge>>;
  try {
    challenge = await getPendingDiscordDmChallenge(db, {
      challengeIdDigest,
      clientNonceDigest,
      nowSeconds,
    });
  } catch {
    return verifyFailureResponse(secure, true, 503);
  }
  if (!challenge) return verifyFailureResponse(secure, true);

  const suppliedCodeDigest = await discordDmCodeDigest(
    config.otpPepper,
    challengeIdDigest,
    challenge.discordId,
    code,
  );
  if (!equalHex(suppliedCodeDigest, challenge.codeDigest)) {
    try {
      const failure = await recordDiscordDmChallengeFailure(db, {
        challengeIdDigest,
        clientNonceDigest,
        nowSeconds,
        failedAt: new Date(nowSeconds * 1000).toISOString(),
      });
      return verifyFailureResponse(secure, failure.terminal);
    } catch {
      return verifyFailureResponse(secure, true, 503);
    }
  }

  // Re-check exact current membership after the code was supplied. A member
  // who left the guild during the five-minute window cannot create a session.
  const member = await findDiscordDmGuildMember(
    config,
    { kind: "id", value: challenge.discordId },
    fetcher,
    timeoutMs,
  );
  const consumedAt = new Date(nowSeconds * 1000).toISOString();
  if (!member) {
    try {
      await invalidateDiscordDmChallenge(db, { challengeIdDigest, invalidatedAt: consumedAt });
    } catch {
      // The response remains the same whether invalidation succeeded or not.
    }
    return verifyFailureResponse(secure, true);
  }

  const session = await createSessionArtifact(config.sessionSecret, member.id, nowSeconds, {
    ttlSeconds: DM_SESSION_TTL_SECONDS,
    authentication: DM_SESSION_AUTHENTICATION,
  });
  try {
    const consumed = await consumeDiscordDmChallenge(db, {
      challengeIdDigest,
      clientNonceDigest,
      codeDigest: suppliedCodeDigest,
      nowSeconds,
      consumedAt,
    });
    if (!consumed) return verifyFailureResponse(secure, true);
    await establishDiscordSession(db, member, {
      id: session.sessionId,
      expiresAt: session.expiresAt,
      authMethod: session.authMethod,
      assuranceLevel: session.assuranceLevel,
    });
  } catch {
    return verifyFailureResponse(secure, true, 503);
  }
  try {
    await updateGuildMembership(db, {
      discordId: member.id,
      member: true,
      joinedAt: member.joinedAt,
      roles: member.roles,
      syncedAt: consumedAt,
    });
  } catch {
    // Login remains valid: membership was freshly proven before the atomic
    // challenge consume. The ordinary guild sync endpoint can refresh later.
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("set-cookie", cookieHeader(SESSION_COOKIE, session.token, {
    maxAge: DM_SESSION_TTL_SECONDS,
    secure,
  }));
  headers.append("set-cookie", clearDmChallengeCookie(secure));
  return Response.json({ ok: true }, { status: 200, headers });
}
