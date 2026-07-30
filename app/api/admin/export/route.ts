import {
  adminDiscordIds,
  hasRecentAuthentication,
  jsonError,
  readSession,
} from "../../../../server/auth";
import { exportDurableState, getDb } from "../../../../server/passport-db";

export const dynamic = "force-dynamic";

/**
 * 台帳の完全エクスポート。
 *
 * 本番の物理D1はSites側アカウントにあり、オーナーのCloudflareアカウントから
 * 直接exportできない（docs/DEPLOY_HANDOVER_FACTS.md）。このエンドポイントが
 * アプリ自身によるデータの持ち出し口であり、Sites経路が失われても
 * オーナー管理インフラへの移行を可能にする。
 *
 * 対象は永続台帳のみ: players / point_grants / gacha_pulls /
 * game_account_links / audit_events。セッション・チャレンジ・レート制限は
 * 一時データかつセキュリティ材料なので含めない。
 */
export async function GET(request: Request) {
  const db = await getDb();
  const session = await readSession(request);
  if (!db || !session) return jsonError(401, "NOT_AUTHENTICATED", "Discord連携が必要です。");
  if (!(await adminDiscordIds()).has(session.sub)) {
    return jsonError(403, "NOT_ADMIN", "管理者権限がありません。");
  }
  if (!hasRecentAuthentication(session)) {
    return jsonError(403, "RECENT_AUTH_REQUIRED", "再認証してからエクスポートしてください。");
  }

  const snapshot = await exportDurableState(db);
  return Response.json({
    exportedAt: new Date().toISOString(),
    schemaJournal: "drizzle/meta/_journal.json time of build",
    ...snapshot,
  }, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="my-sgg-export.json"`,
    },
  });
}
