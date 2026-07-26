/**
 * Authentication primitives for the Player Passport.
 *
 * Browser tokens are purpose-bound HMAC envelopes. A session cookie is only
 * an assertion: its random id must also resolve to an active D1 row, allowing
 * logout and future incident response to revoke it immediately.
 */

export type PlayerOsEnv = {
  DB?: D1Database;
  APP_ORIGIN?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
  ADMIN_DISCORD_IDS?: string;
  DISCORD_BOT_TOKEN?: string;
  DISCORD_GUILD_ID?: string;
  DM_OTP_PEPPER?: string;
  INTEGRATION_GRANT_SECRET?: string;
  INTEGRATION_ACTOR_ID?: string;
  OTOMO_CHAIN_EXPORT_URL?: string;
  OTOMO_CHAIN_ADMIN_SECRET?: string;
};

let cachedEnv: PlayerOsEnv | null = null;

/**
 * `cloudflare:workers` only resolves inside workerd, so it is imported lazily:
 * SSR tests running under plain Node get an empty env and every endpoint fails
 * closed instead of crashing at module load.
 */
export async function playerOsEnv(): Promise<PlayerOsEnv> {
  if (cachedEnv) return cachedEnv;
  try {
    const { env } = await import("cloudflare:workers");
    cachedEnv = env as unknown as PlayerOsEnv;
    return cachedEnv;
  } catch {
    return {};
  }
}

export const SESSION_COOKIE = "sgg_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const DM_SESSION_TTL_SECONDS = 24 * 60 * 60;

export type AuthMethod = "discord_oauth" | "discord_dm";
export type AssuranceLevel = 1 | 2;

export type SessionAuthentication = {
  authMethod: AuthMethod;
  assuranceLevel: AssuranceLevel;
};

export const OAUTH_SESSION_AUTHENTICATION: SessionAuthentication = {
  authMethod: "discord_oauth",
  assuranceLevel: 2,
};

export const DM_SESSION_AUTHENTICATION: SessionAuthentication = {
  authMethod: "discord_dm",
  assuranceLevel: 1,
};

export type TokenPurpose = "oauth-state" | "session" | "wallet-challenge";

const TOKEN_VERSION = "v2";
const TOKEN_DOMAIN = "SGG_PLAYER_PASSPORT";
const MAX_TOKEN_LENGTH = 4096;
const PURPOSE_TTL_LIMITS: Record<TokenPurpose, number> = {
  "oauth-state": 10 * 60,
  session: SESSION_TTL_SECONDS,
  "wallet-challenge": 10 * 60,
};
const encoder = new TextEncoder();

export type DiscordAuthConfig = {
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
  db: D1Database;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const standard = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(secret: string, purpose: TokenPurpose): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(`${TOKEN_DOMAIN}\u0000${purpose}\u0000${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Reject absent, short, padded-with-whitespace, and low-diversity secrets. */
export function isStrongSessionSecret(value: unknown): value is string {
  if (typeof value !== "string" || value !== value.trim()) return false;
  if (encoder.encode(value).byteLength < 32) return false;
  return new Set(value).size >= 8;
}

export function discordAuthConfigFromEnv(env: PlayerOsEnv): DiscordAuthConfig | null {
  if (
    !env.DB ||
    typeof env.DISCORD_CLIENT_ID !== "string" ||
    !/^\d{5,30}$/.test(env.DISCORD_CLIENT_ID) ||
    typeof env.DISCORD_CLIENT_SECRET !== "string" ||
    encoder.encode(env.DISCORD_CLIENT_SECRET).byteLength < 24 ||
    !isStrongSessionSecret(env.SESSION_SECRET)
  ) {
    return null;
  }
  return {
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
    sessionSecret: env.SESSION_SECRET,
    db: env.DB,
  };
}

export async function discordAuthConfig(): Promise<DiscordAuthConfig | null> {
  return discordAuthConfigFromEnv(await playerOsEnv());
}

/**
 * Normalizes an optional deployment origin. It must be a bare HTTPS origin;
 * loopback HTTP is allowed for local development only.
 */
export function canonicalAppOrigin(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) return null;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Returns the origin to bind into OAuth/challenge state. When APP_ORIGIN is
 * configured, requests presenting any other origin fail closed.
 */
export function resolveAppOrigin(request: Request, configuredValue: unknown): string | null {
  let requestOrigin: string;
  try {
    const url = new URL(request.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    requestOrigin = url.origin;
  } catch {
    return null;
  }

  if (configuredValue === undefined || configuredValue === null || configuredValue === "") {
    return requestOrigin;
  }
  const configuredOrigin = canonicalAppOrigin(configuredValue);
  return configuredOrigin && configuredOrigin === requestOrigin ? configuredOrigin : null;
}

type CommonTokenClaims = {
  purpose: TokenPurpose;
  iat: number;
  exp: number;
};

export async function signPurposeToken<T extends { iat: number; exp: number }>(
  secret: string,
  purpose: TokenPurpose,
  claims: T,
): Promise<string> {
  if (!isStrongSessionSecret(secret)) throw new Error("SESSION_SECRET is not sufficiently strong");
  if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.exp <= claims.iat) {
    throw new Error("Token timestamps are invalid");
  }
  if (claims.exp - claims.iat > PURPOSE_TTL_LIMITS[purpose]) {
    throw new Error("Token lifetime exceeds its purpose limit");
  }

  const payload: CommonTokenClaims & T = { ...claims, purpose };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${TOKEN_VERSION}.${body}`;
  const key = await hmacKey(secret, purpose);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput)),
  );
  return `${signingInput}.${toBase64Url(signature)}`;
}

export async function verifyPurposeToken<T extends object>(
  secret: string,
  purpose: TokenPurpose,
  token: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<(T & CommonTokenClaims) | null> {
  if (!isStrongSessionSecret(secret) || !token || token.length > MAX_TOKEN_LENGTH) return null;
  const [version, body, signature, extra] = token.split(".");
  if (version !== TOKEN_VERSION || !body || !signature || extra) return null;

  const signatureBytes = fromBase64Url(signature);
  if (!signatureBytes) return null;

  const key = await hmacKey(secret, purpose);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes as unknown as BufferSource,
    encoder.encode(`${version}.${body}`),
  );
  if (!valid) return null;

  const payloadBytes = fromBase64Url(body);
  if (!payloadBytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const claims = parsed as CommonTokenClaims & T;
    if (
      claims.purpose !== purpose ||
      !Number.isInteger(claims.iat) ||
      !Number.isInteger(claims.exp) ||
      claims.exp <= claims.iat ||
      claims.iat > nowSeconds + 300 ||
      claims.exp <= nowSeconds ||
      claims.exp - claims.iat > PURPOSE_TTL_LIMITS[purpose]
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return toBase64Url(buffer);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export function normalizeWalletAddress(value: unknown): string | null {
  return typeof value === "string" && EVM_ADDRESS_PATTERN.test(value) ? value.toLowerCase() : null;
}

export function buildWalletMessage(fields: {
  discordId: string;
  address: string;
  nonce: string;
  issuedAt: string;
  origin: string;
}) {
  return [
    "MY SGG Player Passport — Wallet ownership proof",
    `Origin: ${fields.origin}`,
    `Discord ID: ${fields.discordId}`,
    `Wallet: ${fields.address}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
    "",
    "この署名はアドレス所有の証明のみに使われます。送金やトークン承認は行いません。",
  ].join("\n");
}

export type GrantFingerprintInput = {
  actor: string;
  discordId: string;
  amount: number;
  reasonCode: string;
  note: string | null;
};

export async function grantRequestFingerprint(input: GrantFingerprintInput): Promise<string> {
  // An ordered tuple avoids object-key-order ambiguity across runtimes.
  return sha256Hex(JSON.stringify([
    "SGG_POINT_GRANT_V1",
    input.actor,
    input.discordId,
    input.amount,
    input.reasonCode,
    input.note,
  ]));
}

export function isUniqueConstraintError(error: unknown): boolean {
  return /(?:SQLITE_CONSTRAINT_UNIQUE|UNIQUE constraint failed|D1_ERROR:\s*UNIQUE)/i.test(String(error));
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

export function cookieHeader(
  name: string,
  value: string,
  { maxAge, secure }: { maxAge: number; secure: boolean },
): string {
  const attributes = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

export function clearCookieHeader(name: string, secure: boolean): string {
  return cookieHeader(name, "", { maxAge: 0, secure });
}

export function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

type SessionTokenClaims = {
  sub: string;
  sid: string;
  iat: number;
  exp: number;
};

export type SessionClaims = {
  sub: string;
  sessionId: string;
  iat: number;
  exp: number;
  authMethod: AuthMethod;
  assuranceLevel: AssuranceLevel;
};

export const ADMIN_RECENT_AUTH_SECONDS = 15 * 60;

export function hasRecentAuthentication(
  session: SessionClaims,
  maxAgeSeconds = ADMIN_RECENT_AUTH_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  return isHighAssuranceSession(session) &&
    Number.isInteger(session.iat) &&
    Number.isInteger(maxAgeSeconds) &&
    maxAgeSeconds > 0 &&
    session.iat <= nowSeconds &&
    nowSeconds - session.iat <= maxAgeSeconds;
}

/** DM login is intentionally low assurance and can never authorize admin work. */
export function isHighAssuranceSession(
  session: Pick<SessionClaims, "authMethod" | "assuranceLevel">,
): boolean {
  return session.authMethod === "discord_oauth" && session.assuranceLevel === 2;
}

export async function createSessionArtifact(
  secret: string,
  sub: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  options: {
    ttlSeconds?: number;
    authentication?: SessionAuthentication;
  } = {},
): Promise<{
  token: string;
  sessionId: string;
  expiresAt: number;
  authMethod: AuthMethod;
  assuranceLevel: AssuranceLevel;
}> {
  if (!/^\d{5,25}$/.test(sub)) throw new Error("Discord subject is invalid");
  const ttlSeconds = options.ttlSeconds ?? SESSION_TTL_SECONDS;
  const authentication = options.authentication ?? OAUTH_SESSION_AUTHENTICATION;
  const validAuthentication =
    (authentication.authMethod === "discord_oauth" && authentication.assuranceLevel === 2) ||
    (authentication.authMethod === "discord_dm" && authentication.assuranceLevel === 1);
  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds <= 0 ||
    ttlSeconds > SESSION_TTL_SECONDS ||
    !validAuthentication ||
    (authentication.authMethod === "discord_dm" && ttlSeconds > DM_SESSION_TTL_SECONDS)
  ) {
    throw new Error("Session authentication context is invalid");
  }
  const sid = randomToken(32);
  const expiresAt = nowSeconds + ttlSeconds;
  const token = await signPurposeToken(secret, "session", {
    sub,
    sid,
    iat: nowSeconds,
    exp: expiresAt,
  });
  return {
    token,
    sessionId: await sha256Hex(sid),
    expiresAt,
    ...authentication,
  };
}

/** Verifies both the signed assertion and its active, non-revoked D1 row. */
export async function readSession(request: Request): Promise<SessionClaims | null> {
  const env = await playerOsEnv();
  if (!env.DB || !isStrongSessionSecret(env.SESSION_SECRET)) return null;
  const claims = await verifyPurposeToken<SessionTokenClaims>(
    env.SESSION_SECRET,
    "session",
    readCookie(request, SESSION_COOKIE),
  );
  if (
    !claims ||
    typeof claims.sub !== "string" ||
    !/^\d{5,25}$/.test(claims.sub) ||
    typeof claims.sid !== "string" ||
    claims.sid.length < 32
  ) {
    return null;
  }

  const sessionId = await sha256Hex(claims.sid);
  try {
    const row = await env.DB.prepare(
      `SELECT id, auth_method, assurance_level FROM auth_sessions
       WHERE id = ?1 AND discord_id = ?2 AND revoked_at IS NULL
         AND expires_at = ?3 AND expires_at > ?4
       LIMIT 1`,
    )
      .bind(sessionId, claims.sub, claims.exp, Math.floor(Date.now() / 1000))
      .first<{ id: string; auth_method: unknown; assurance_level: unknown }>();
    if (
      !row ||
      row.id !== sessionId ||
      (row.auth_method !== "discord_oauth" && row.auth_method !== "discord_dm") ||
      (row.assurance_level !== 1 && row.assurance_level !== 2) ||
      (row.auth_method === "discord_oauth" && row.assurance_level !== 2) ||
      (row.auth_method === "discord_dm" && row.assurance_level !== 1)
    ) {
      return null;
    }
    return {
      sub: claims.sub,
      sessionId,
      iat: claims.iat,
      exp: claims.exp,
      authMethod: row.auth_method,
      assuranceLevel: row.assurance_level,
    };
  } catch {
    // Missing/unmigrated bindings and D1 failures are authentication failures.
    return null;
  }

  return null;
}

export async function adminDiscordIds(): Promise<Set<string>> {
  return new Set(
    ((await playerOsEnv()).ADMIN_DISCORD_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => /^\d{5,25}$/.test(value)),
  );
}

/**
 * Cross-site request forgery guard for JSON mutation endpoints. SameSite=Lax
 * blocks cross-site cookie sends; the custom header also forces a CORS
 * preflight and keeps every mutation an explicit fetch call.
 */
export function hasJsonRequestHeader(request: Request): boolean {
  return request.headers.get("x-sgg-request") === "1";
}

export function jsonError(status: number, code: string, message: string) {
  return Response.json(
    { ok: false, code, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
