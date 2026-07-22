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
  assert.match(source, /DMコードを受け取る/);
  assert.match(source, /\/api\/auth\/discord\/dm\/start/);
  assert.match(source, /\/api\/auth\/discord\/dm\/verify/);
  assert.match(source, /autoComplete="one-time-code"/);
  assert.match(source, /SGGスタッフがコードを尋ねることはありません/);
  assert.match(source, /DISCORD_DM_IDENTITY_PATTERN/);
  assert.match(source, /DISCORD_DM_CODE_PATTERN/);
  assert.match(source, /replaceAll\("-", ""\)/);
  assert.match(source, /dmChallenge\.expiresAt - Date\.now\(\)/);
  assert.match(source, /adminUpgradeRequired/);
  assert.match(source, /管理者としてDiscord再認証/);
  assert.match(source, /dmIdentityInputRef\.current\?\.focus\(\)/);
  assert.match(source, /OAuthの準備が整うまで管理機能は利用できません/);
  assert.doesNotMatch(source, /ABCDE-FGHIJ/);
  assert.ok(
    source.indexOf("Discordで連携する") < source.indexOf("OAuthが使えない場合"),
    "OAuth remains the primary route before the low-assurance DM fallback",
  );
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
  assert.match(css, /\.searchBox input,\s*\n\s*\.grantForm input,\s*\n\s*\.dmAuthForm input \{\s*\n\s*font-size: 16px/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-right/);
  assert.match(css, /safe-area-inset-left/);
});
