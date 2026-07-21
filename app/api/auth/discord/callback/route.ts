import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionArtifact,
  clearCookieHeader,
  cookieHeader,
  discordAuthConfigFromEnv,
  isSecureRequest,
  jsonError,
  playerOsEnv,
  readCookie,
  resolveAppOrigin,
  verifyPurposeToken,
} from "../../../../../server/auth";
import { fetchGuildMember, guildSyncConfigFromEnv } from "../../../../../server/discord-guild";
import {
  establishDiscordSession,
  getDb,
  updateGuildMembership,
} from "../../../../../server/passport-db";
import { OAUTH_STATE_COOKIE } from "../route";

export const dynamic = "force-dynamic";

function redirectWithError(origin: string, secure: boolean, reason: string): Response {
  const headers = new Headers({
    location: `${origin}/#mysgg`,
    "cache-control": "no-store",
  });
  headers.append("set-cookie", clearCookieHeader(OAUTH_STATE_COOKIE, secure));
  headers.append(
    "set-cookie",
    // Readable by the client for a one-shot toast; not an auth artifact.
    `sgg_auth_error=${reason}; Path=/; SameSite=Lax; Max-Age=30${secure ? "; Secure" : ""}`,
  );
  return new Response(null, { status: 302, headers });
}

export async function GET(request: Request) {
  const env = await playerOsEnv();
  const config = discordAuthConfigFromEnv(env);
  const db = await getDb();
  const url = new URL(request.url);
  const origin = resolveAppOrigin(request, env.APP_ORIGIN);
  const secure = isSecureRequest(request);

  if (!config || !db) {
    return jsonError(503, "AUTH_NOT_CONFIGURED", "Discord連携は現在準備中です。");
  }
  if (!origin) {
    return jsonError(400, "ORIGIN_MISMATCH", "Discord連携の戻り先が一致しません。");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateClaims = await verifyPurposeToken<{ state: string; origin: string }>(
    config.sessionSecret,
    "oauth-state",
    readCookie(request, OAUTH_STATE_COOKIE),
  );
  if (
    !code ||
    !state ||
    !stateClaims ||
    stateClaims.state !== state ||
    stateClaims.origin !== origin
  ) {
    return redirectWithError(origin, secure, "state_mismatch");
  }

  let profile: { id: string; username: string; globalName: string | null; avatarHash: string | null };
  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${origin}/api/auth/discord/callback`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok) throw new Error(`token HTTP ${tokenResponse.status}`);
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) throw new Error("missing access_token");

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!userResponse.ok) throw new Error(`user HTTP ${userResponse.status}`);
    const user = await userResponse.json() as {
      id?: string;
      username?: string;
      global_name?: string | null;
      avatar?: string | null;
    };
    if (
      typeof user.id !== "string" ||
      !/^\d{5,25}$/.test(user.id) ||
      typeof user.username !== "string" ||
      !user.username ||
      user.username.length > 80
    ) {
      throw new Error("malformed user payload");
    }
    profile = {
      id: user.id,
      username: user.username,
      globalName: typeof user.global_name === "string" && user.global_name.length <= 100
        ? user.global_name
        : null,
      avatarHash: typeof user.avatar === "string" && /^[A-Za-z0-9_]+$/.test(user.avatar)
        ? user.avatar
        : null,
    };
  } catch {
    return redirectWithError(origin, secure, "discord_exchange_failed");
  }

  const session = await createSessionArtifact(config.sessionSecret, profile.id);
  try {
    await establishDiscordSession(db, profile, {
      id: session.sessionId,
      expiresAt: session.expiresAt,
    });
  } catch {
    return redirectWithError(origin, secure, "persistence_failed");
  }

  // Best-effort guild membership snapshot: sync failures must never block
  // login, and they keep the previous durable state instead of guessing.
  const guildConfig = guildSyncConfigFromEnv(env);
  if (guildConfig) {
    try {
      const snapshot = await fetchGuildMember(guildConfig, profile.id, 5_000);
      if (snapshot) {
        await updateGuildMembership(db, {
          discordId: profile.id,
          member: snapshot.member,
          joinedAt: snapshot.joinedAt,
          roles: snapshot.roles,
          syncedAt: new Date().toISOString(),
        });
      }
    } catch {
      // Ignore: the manual /api/guild/sync endpoint can retry later.
    }
  }

  const headers = new Headers({
    location: `${origin}/#mysgg`,
    "cache-control": "no-store",
  });
  headers.append("set-cookie", cookieHeader(SESSION_COOKIE, session.token, {
    maxAge: SESSION_TTL_SECONDS,
    secure,
  }));
  headers.append("set-cookie", clearCookieHeader(OAUTH_STATE_COOKIE, secure));
  return new Response(null, { status: 302, headers });
}
