import { and, eq } from "drizzle-orm";

import { holdingsTokenCache } from "../../../../db/schema";
import { jsonError, readSession } from "../../../../server/auth";
import { enumerateOwnedTokens, type TokenPage } from "../../../../server/onchain-holdings";
import { getDb, getPlayer } from "../../../../server/passport-db";

export const dynamic = "force-dynamic";

/**
 * 表示専用データなので、5分は古い結果を許容して公開RPCへの照会を省く。
 * 残高やランクには一切影響しないため、この鮮度で困る利用者はいない。
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * タップで開くNFTギャラリーの1ページ。アドレスは常にサーバー側の
 * player行から取り、リクエストの言い値では読まない。表示専用。
 */
export async function GET(request: Request) {
  const db = await getDb();
  const session = await readSession(request);
  if (!db || !session) return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");

  const player = await getPlayer(db, session.sub);
  if (!player) return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");
  if (!player.walletAddress) {
    return jsonError(409, "WALLET_NOT_LINKED", "Walletが未連携です。");
  }

  const url = new URL(request.url);
  const collection = url.searchParams.get("collection") ?? "";
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 && offsetRaw <= 5_000 ? offsetRaw : 0;

  const wallet = player.walletAddress.toLowerCase();
  const cacheKey = and(
    eq(holdingsTokenCache.walletAddress, wallet),
    eq(holdingsTokenCache.collectionId, collection),
    eq(holdingsTokenCache.offset, offset),
  );

  const cached = await db.select().from(holdingsTokenCache).where(cacheKey).limit(1);
  if (cached.length === 1) {
    const age = Date.now() - Date.parse(`${cached[0].fetchedAt.replace(" ", "T")}Z`);
    if (Number.isFinite(age) && age >= 0 && age < CACHE_TTL_MS) {
      try {
        const page = JSON.parse(cached[0].payload) as TokenPage;
        return Response.json(page, { headers: { "Cache-Control": "no-store", "X-Token-Cache": "hit" } });
      } catch {
        // 壊れた行は無視してチェーンから読み直す。
      }
    }
  }

  const page = await enumerateOwnedTokens(player.walletAddress, collection, offset);
  if (!page) return jsonError(400, "BAD_COLLECTION", "対象コレクションが不正です。");

  // 失敗形(supported=false)はキャッシュしない: RPCの一時不調を5分固定しないため。
  if (page.supported) {
    const payload = JSON.stringify(page);
    await db.delete(holdingsTokenCache).where(cacheKey);
    await db.insert(holdingsTokenCache).values({
      walletAddress: wallet,
      collectionId: collection,
      offset,
      payload,
    });
  }

  return Response.json(page, { headers: { "Cache-Control": "no-store", "X-Token-Cache": "miss" } });
}
