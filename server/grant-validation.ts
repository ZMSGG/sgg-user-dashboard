/**
 * Shared request validation for point grants, used by both the admin
 * endpoint and the server-to-server integration endpoint so the two paths
 * cannot drift apart in what the append-only ledger accepts.
 */

export const GRANT_REASON_PATTERN = /^[A-Z0-9_]{3,64}$/;
export const GRANT_MAX_ABS_AMOUNT = 1_000_000;
export const GRANT_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export type GrantPayload = {
  discordId: string;
  amount: number;
  reasonCode: string;
  note: string | null;
  idempotencyKey: string;
};

export type GrantParseResult =
  | { ok: true; value: GrantPayload }
  | { ok: false; code: string; message: string };

export function parseGrantPayload(body: {
  discordId?: unknown;
  amount?: unknown;
  reasonCode?: unknown;
  note?: unknown;
  idempotencyKey?: unknown;
}): GrantParseResult {
  if (typeof body.discordId !== "string" || !/^\d{5,25}$/.test(body.discordId)) {
    return { ok: false, code: "BAD_TARGET", message: "付与先のDiscord IDが不正です。" };
  }
  if (
    typeof body.amount !== "number" ||
    !Number.isInteger(body.amount) ||
    body.amount === 0 ||
    Math.abs(body.amount) > GRANT_MAX_ABS_AMOUNT
  ) {
    return {
      ok: false,
      code: "BAD_AMOUNT",
      message: "付与量は0以外の整数(±1,000,000以内)で指定してください。",
    };
  }
  if (typeof body.reasonCode !== "string" || !GRANT_REASON_PATTERN.test(body.reasonCode)) {
    return {
      ok: false,
      code: "BAD_REASON",
      message: "理由コードはA-Z0-9_の3〜64文字で指定してください。",
    };
  }
  if (
    typeof body.idempotencyKey !== "string" ||
    !GRANT_IDEMPOTENCY_KEY_PATTERN.test(body.idempotencyKey)
  ) {
    return { ok: false, code: "BAD_IDEMPOTENCY_KEY", message: "冪等キーが不正です。" };
  }
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") {
    return { ok: false, code: "BAD_NOTE", message: "メモ形式が不正です。" };
  }
  if (typeof body.note === "string" && body.note.length > 500) {
    return { ok: false, code: "BAD_NOTE", message: "メモは500文字以内で指定してください。" };
  }
  const normalizedNote = typeof body.note === "string" ? body.note.trim() : "";
  return {
    ok: true,
    value: {
      discordId: body.discordId,
      amount: body.amount,
      reasonCode: body.reasonCode,
      note: normalizedNote || null,
      idempotencyKey: body.idempotencyKey,
    },
  };
}
