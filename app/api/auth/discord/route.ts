import {
  cookieHeader,
  discordAuthConfigFromEnv,
  isSecureRequest,
  jsonError,
  playerOsEnv,
  randomToken,
  resolveAppOrigin,
  signPurposeToken,
} from "../../../../server/auth";

export const dynamic = "force-dynamic";

export const OAUTH_STATE_COOKIE = "sgg_oauth_state";

/** Starts the Discord authorization-code flow. */
export async function GET(request: Request) {
  const env = await playerOsEnv();
  const config = discordAuthConfigFromEnv(env);
  if (!config) {
    return jsonError(503, "AUTH_NOT_CONFIGURED", "Discord連携は現在準備中です。");
  }

  const origin = resolveAppOrigin(request, env.APP_ORIGIN);
  if (!origin) {
    return jsonError(400, "ORIGIN_MISMATCH", "このURLからDiscord連携を開始できません。");
  }

  const now = Math.floor(Date.now() / 1000);
  const state = randomToken(32);
  const stateToken = await signPurposeToken(config.sessionSecret, "oauth-state", {
    state,
    origin,
    iat: now,
    exp: now + 600,
  });

  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("redirect_uri", `${origin}/api/auth/discord/callback`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      location: authorizeUrl.toString(),
      "set-cookie": cookieHeader(OAUTH_STATE_COOKIE, stateToken, {
        maxAge: 600,
        secure: isSecureRequest(request),
      }),
      "cache-control": "no-store",
    },
  });
}
