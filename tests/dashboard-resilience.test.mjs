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
  assert.match(source, /Discordでログイン/);
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
    source.indexOf("Discordでログイン") < source.indexOf("OAuthが使えない場合"),
    "OAuth remains the primary route before the low-assurance DM fallback",
  );
  assert.match(source, /Passport情報を取得できませんでした/);
  assert.match(source, /refreshPassport\(\{ showLoading: true \}\)/);

  // The in-dashboard admin grant panel and its roster were removed (owner
  // direction 2026-08-17): distribution runs through the operator flow against
  // the admin API, never through a browser form the owner would have to drive.
  assert.doesNotMatch(source, /adminRosterState/);
  assert.doesNotMatch(source, /loadAdminPlayers/);
  assert.doesNotMatch(source, /付与先/);
  assert.doesNotMatch(source, /\/api\/admin\/grants/);
});

test("makes wallet mutations safe to confirm or retry", async () => {
  const source = await readFile(dashboardUrl, "utf8");

  assert.match(source, /"\/api\/wallet\/challenge", \{ address \}/);
  assert.match(source, /window\.confirm/);
  assert.match(source, /ポイント履歴とDiscord連携は維持されます/);
});

test("ships keyboard, mobile form, and safe-area accessibility guards", async () => {
  const [source, css] = await Promise.all([
    readFile(dashboardUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  // The topbar — and with it the global search combobox and the notification
  // popover — was removed (owner direction 2026-07-30). The remaining
  // interactive surfaces are the 推しGODS picker, the 軌跡 search, and the
  // DM auth forms.
  assert.match(source, /role="listbox"/);
  assert.match(source, /role="option"/);
  assert.match(source, /aria-selected=/);
  assert.match(source, /aria-expanded=\{stagePickerOpen\}/);

  assert.match(css, /:focus-visible/);
  assert.match(css, /\.trajectorySearch,\s*\n\s*\.dmAuthForm input \{\s*\n\s*font-size: 16px/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-right/);
  assert.match(css, /safe-area-inset-left/);
});
