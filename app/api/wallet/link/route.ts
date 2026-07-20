import { eq } from "drizzle-orm";
import { verifyMessage } from "viem";
import { players } from "../../../../db/schema";
import {
  buildWalletMessage,
  clearCookieHeader,
  hasJsonRequestHeader,
  isSecureRequest,
  isStrongSessionSecret,
  jsonError,
  normalizeWalletAddress,
  playerOsEnv,
  readCookie,
  readSession,
  resolveAppOrigin,
  verifyPurposeToken,
} from "../../../../server/auth";
import {
  consumeWalletChallenge,
  getDb,
  getPendingWalletChallenge,
  getPlayer,
  isUniqueConstraintError,
  linkWalletWithAudit,
} from "../../../../server/passport-db";
import { WALLET_CHALLENGE_COOKIE } from "../challenge/route";

export const dynamic = "force-dynamic";

function spentChallengeError(request: Request, status: number, code: string, message: string) {
  const response = jsonError(status, code, message);
  response.headers.append(
    "set-cookie",
    clearCookieHeader(WALLET_CHALLENGE_COOKIE, isSecureRequest(request)),
  );
  return response;
}

export async function POST(request: Request) {
  if (!hasJsonRequestHeader(request)) {
    return jsonError(403, "BAD_REQUEST_HEADER", "不正なリクエストです。");
  }
  const env = await playerOsEnv();
  const db = await getDb();
  const session = await readSession(request);
  if (!db || !session || !isStrongSessionSecret(env.SESSION_SECRET)) {
    return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");
  }
  const origin = resolveAppOrigin(request, env.APP_ORIGIN);
  if (!origin) return jsonError(400, "ORIGIN_MISMATCH", "Wallet連携元のURLが一致しません。");

  let body: { address?: unknown; signature?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return jsonError(400, "BAD_JSON", "リクエスト本文を読み取れません。");
  }
  const address = normalizeWalletAddress(body.address);
  if (!address) return jsonError(400, "BAD_ADDRESS", "アドレス形式が不正です。");
  if (
    typeof body.signature !== "string" ||
    !/^0x[0-9a-fA-F]+$/.test(body.signature) ||
    body.signature.length > 4096
  ) {
    return jsonError(400, "BAD_SIGNATURE", "署名形式が不正です。");
  }

  const challengeClaims = await verifyPurposeToken<{
    cid: string;
    sub: string;
    address: string;
    origin: string;
  }>(
    env.SESSION_SECRET,
    "wallet-challenge",
    readCookie(request, WALLET_CHALLENGE_COOKIE),
  );
  if (
    !challengeClaims ||
    typeof challengeClaims.cid !== "string" ||
    challengeClaims.cid.length < 32 ||
    challengeClaims.sub !== session.sub ||
    challengeClaims.address !== address ||
    challengeClaims.origin !== origin
  ) {
    return spentChallengeError(
      request,
      400,
      "CHALLENGE_EXPIRED",
      "署名チャレンジが無効です。もう一度お試しください。",
    );
  }

  const challengeKey = {
    id: challengeClaims.cid,
    sessionId: session.sessionId,
    discordId: session.sub,
    address,
    nowSeconds: Math.floor(Date.now() / 1000),
  };
  const challenge = await getPendingWalletChallenge(db, challengeKey);
  if (
    !challenge ||
    challenge.origin !== origin ||
    challenge.expiresAt !== challengeClaims.exp
  ) {
    return spentChallengeError(
      request,
      400,
      "CHALLENGE_EXPIRED",
      "署名チャレンジが無効です。もう一度お試しください。",
    );
  }

  const message = buildWalletMessage({
    discordId: challenge.discordId,
    address: challenge.address,
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt,
    origin: challenge.origin,
  });

  let signatureValid = false;
  try {
    signatureValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: body.signature as `0x${string}`,
    });
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    return jsonError(400, "SIGNATURE_INVALID", "署名を検証できませんでした。");
  }

  if (!await consumeWalletChallenge(db, challengeKey)) {
    return spentChallengeError(
      request,
      409,
      "CHALLENGE_REPLAYED",
      "この署名チャレンジは使用済みです。もう一度お試しください。",
    );
  }

  // Friendly pre-check. The database's partial UNIQUE index remains the final
  // arbiter and the write below translates a concurrent claimant into 409.
  const owner = await db
    .select({ discordId: players.discordId })
    .from(players)
    .where(eq(players.walletAddress, address))
    .limit(1);
  if (owner[0] && owner[0].discordId !== session.sub) {
    return spentChallengeError(request, 409, "WALLET_TAKEN", "このWalletは別のプレイヤーに連携済みです。");
  }

  const player = await getPlayer(db, session.sub);
  if (!player) return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");

  const now = new Date().toISOString();
  try {
    await linkWalletWithAudit(db, {
      session,
      address,
      previousAddress: player.walletAddress,
      linkedAt: now,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return spentChallengeError(request, 409, "WALLET_TAKEN", "このWalletは別のプレイヤーに連携済みです。");
    }
    throw error;
  }

  return Response.json(
    { ok: true, walletAddress: address, walletLinkedAt: now },
    {
      headers: {
        "set-cookie": clearCookieHeader(WALLET_CHALLENGE_COOKIE, isSecureRequest(request)),
        "cache-control": "no-store",
      },
    },
  );
}
