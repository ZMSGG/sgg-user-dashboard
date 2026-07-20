import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardUrl = new URL("../app/Dashboard.tsx", import.meta.url);
const stylesUrl = new URL("../app/Dashboard.module.css", import.meta.url);

test("keeps Passport and admin roster load outcomes distinct and retryable", async () => {
  const source = await readFile(dashboardUrl, "utf8");

  assert.match(source, /passportState/);
  assert.match(source, /PLAYER BRIDGE · CHECKING/);
  assert.match(source, /PLAYER BRIDGE · UNAVAILABLE/);
  assert.match(source, /Discord連携を準備中/);
  assert.match(source, /Discordで連携する/);
  assert.match(source, /Passport情報を取得できませんでした/);
  assert.match(source, /refreshPassport\(\{ showLoading: true \}\)/);

  assert.match(source, /adminRosterState === "loading"/);
  assert.match(source, /adminRosterState === "error"/);
  assert.match(source, /まだDiscord連携したプレイヤーがいません/);
  assert.match(source, /空の一覧としては扱っていません/);
  assert.match(source, /loadAdminPlayers\(\)/);
});

test("makes wallet and point mutations safe to confirm or retry", async () => {
  const source = await readFile(dashboardUrl, "utf8");

  assert.match(source, /"\/api\/wallet\/challenge", \{ address \}/);
  assert.match(source, /window\.confirm/);
  assert.match(source, /ポイント履歴とDiscord連携は維持されます/);

  assert.match(source, /grantAttemptRef/);
  assert.match(source, /const fingerprint = JSON\.stringify\(grantPayload\)/);
  assert.match(source, /grantAttemptRef\.current\.fingerprint !== fingerprint/);
  assert.match(source, /idempotencyKey: grantAttemptRef\.current\.idempotencyKey/);
  assert.match(source, /grantAttemptRef\.current = null/);
  assert.doesNotMatch(source, /idempotencyKey: crypto\.randomUUID\(\),/);
});

test("ships keyboard, mobile form, and safe-area accessibility guards", async () => {
  const [source, css] = await Promise.all([
    readFile(dashboardUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(source, /aria-controls="notification-panel"/);
  assert.match(source, /aria-haspopup="dialog"/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /notificationPanelRef\.current\?\.focus\(\)/);
  assert.match(source, /notificationTriggerRef\.current\?\.focus\(\)/);

  assert.match(css, /:focus-visible/);
  assert.match(css, /\.searchBox input,\s*\n\s*\.grantForm input \{\s*\n\s*font-size: 16px/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-right/);
  assert.match(css, /safe-area-inset-left/);
});
