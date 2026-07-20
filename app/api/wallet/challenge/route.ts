import {
  buildWalletMessage,
  cookieHeader,
  hasJsonRequestHeader,
  isSecureRequest,
  isStrongSessionSecret,
  jsonError,
  normalizeWalletAddress,
  playerOsEnv,
  randomToken,
  readSession,
  resolveAppOrigin,
  signPurposeToken,
} from "../../../../server/auth";
import { createWalletChallenge, getDb } from "../../../../server/passport-db";

export const dynamic = "force-dynamic";

export const WALLET_CHALLENGE_COOKIE = "sgg_wallet_challenge";

export async function POST(request: Request) {
  if (!hasJsonRequestHeader(request)) {
    return jsonError(403, "BAD_REQUEST_HEADER", "不正なリクエストです。");
  }

  let body: { address?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return jsonError(400, "BAD_JSON", "リクエスト本文を読み取れません。");
  }
  const address = normalizeWalletAddress(body.address);
  if (!address) return jsonError(400, "BAD_ADDRESS", "アドレス形式が不正です。");

  const env = await playerOsEnv();
  const db = await getDb();
  const session = await readSession(request);
  if (!db || !session || !isStrongSessionSecret(env.SESSION_SECRET)) {
    return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");
  }
  const origin = resolveAppOrigin(request, env.APP_ORIGIN);
  if (!origin) {
    return jsonError(400, "ORIGIN_MISMATCH", "このURLからWallet連携を開始できません。");
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 600;
  const challengeId = randomToken(32);
  const nonce = randomToken(32);
  const issuedAt = new Date(now * 1000).toISOString();

  try {
    await createWalletChallenge(db, {
      id: challengeId,
      sessionId: session.sessionId,
      discordId: session.sub,
      address,
      nonce,
      origin,
      issuedAt,
      expiresAt,
    });
  } catch {
    return jsonError(503, "CHALLENGE_STORAGE_UNAVAILABLE", "署名チャレンジを作成できませんでした。");
  }

  const challengeToken = await signPurposeToken(env.SESSION_SECRET, "wallet-challenge", {
    cid: challengeId,
    sub: session.sub,
    address,
    origin,
    iat: now,
    exp: expiresAt,
  });
  const message = buildWalletMessage({
    discordId: session.sub,
    address,
    nonce,
    issuedAt,
    origin,
  });

  return Response.json(
    { ok: true, address, message, expiresAt },
    {
      headers: {
        "set-cookie": cookieHeader(WALLET_CHALLENGE_COOKIE, challengeToken, {
          maxAge: 600,
          secure: isSecureRequest(request),
        }),
        "cache-control": "no-store",
      },
    },
  );
}
