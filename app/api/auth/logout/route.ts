import {
  SESSION_COOKIE,
  clearCookieHeader,
  hasJsonRequestHeader,
  isSecureRequest,
  jsonError,
  readSession,
} from "../../../../server/auth";
import { getDb, revokeSessionWithAudit } from "../../../../server/passport-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasJsonRequestHeader(request)) {
    return jsonError(403, "BAD_REQUEST_HEADER", "不正なリクエストです。");
  }

  const session = await readSession(request);
  if (session) {
    const db = await getDb();
    if (!db) return jsonError(503, "AUTH_STORAGE_UNAVAILABLE", "ログアウトを完了できませんでした。");
    try {
      await revokeSessionWithAudit(db, session);
    } catch {
      return jsonError(503, "AUTH_STORAGE_UNAVAILABLE", "ログアウトを完了できませんでした。");
    }
  }

  return Response.json(
    { ok: true },
    {
      headers: {
        "set-cookie": clearCookieHeader(SESSION_COOKIE, isSecureRequest(request)),
        "cache-control": "no-store",
      },
    },
  );
}
