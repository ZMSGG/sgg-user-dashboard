import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the truthful SGG Player OS", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /All of SGG\. One Player OS/i);
  assert.match(html, /遊ぶ。競う。集める。/);
  // Home surfaces only the titles being taken to market; dormant ones are
  // reachable from プレイ but are not presented here as somewhere to return to.
  assert.match(html, /CHAIN 7/);
  assert.match(html, /FARM 77/);
  assert.match(html, /公開確認済みのゲーム・ランキング・投稿だけを表示/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /property="og:image" content="http:\/\/localhost(?::3000)?\/my-sgg-social-og-v002\.png"/);
  assert.match(html, /name="twitter:image" content="http:\/\/localhost(?::3000)?\/my-sgg-social-og-v002\.png"/);
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
});

test("does not ship fabricated player, asset, tournament, or release data", async () => {
  const [dashboard, data] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-data.ts", import.meta.url), "utf8"),
  ]);
  const source = `${dashboard}\n${data}`;

  for (const value of [
    "EBISU FISHING 77",
    "現在、公開確認済みの大会はありません",
    "ゲーム内資産はまだ接続されていません",
    "COMMUNITY / OFFICIAL SIGNALS",
    "RAW GAMEPLAY SCORE",
    "SGG_GAME_POINTS",
    "SGG TokenはPLANNEDです",
  ]) assert.match(source, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.doesNotMatch(source, /ZEN_TARO|0x7E7A|ORACLE OPEN|SUMMER CIRCUIT|WEEKEND CUP|KAMIZA 7/);
  assert.doesNotMatch(source, /1,284 PLAYING|842 PLAYING|396 IN ROOM|3,000 SGG_GAME_POINTS POOL/);
  assert.doesNotMatch(source, /GODS AUCTION 7|OTOMO CASCADE 7|SEVENGODS TREE 777/);
  assert.doesNotMatch(source, /4,277|12,840|MYTHIC|EPIC|RARE/);
  assert.match(source, /missingを0/);
  assert.match(source, /PLAYER BRIDGE · NOT CONNECTED/);
});

test("keeps canonical pairs, forms, and economic systems separate", async () => {
  const data = await readFile(new URL("../app/dashboard-data.ts", import.meta.url), "utf8");
  for (const value of [
    "EBISU", "TAIMARU", "TAIYO", "KOZUCHI", "SOBI", "MOMOKATSU",
    "SAIKA", "KOTONE", "JURAKU", "JUKA", "FUKUEI", "HAKU", "SHOUREN", "SHOFUKU",
    "SPIRIT", "INCARNATE", "DOJI",
  ]) assert.match(data, new RegExp(`\\b${value}\\b`));

  assert.match(data, /RAW GAMEPLAY SCORE/);
  assert.match(data, /RANKING/);
  assert.match(data, /SGG_GAME_POINTS/);
  assert.match(data, /REWARD CANDIDATE/);
  assert.match(data, /SDT \/ COMMUNITY SCORE/);
  assert.match(data, /SGG Token/);
  assert.doesNotMatch(data, /INCARNATED|獣獣体|\bSDG\b/);
});

test("exposes a same-origin live read model without internal Quest IDs", async () => {
  const response = await render("/api/live");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/i);
  const body = await response.text();
  const payload = JSON.parse(body);
  assert.equal(typeof payload.checkedAt, "string");
  assert.match(payload.servedFrom, /^(origin|cache)$/);
  assert.equal(typeof payload.cacheAgeSeconds, "number");
  assert.equal(typeof payload.sources.oracle, "string");
  assert.equal(typeof payload.sources.quest, "string");
  assert.equal(typeof payload.runtimeOnlineCount, "number");
  assert.ok(payload.runtimeOnlineCount >= 0 && payload.runtimeOnlineCount <= 5);
  for (const key of ["oracle", "quest", "farm", "taiyo", "chain"]) {
    assert.match(payload.runtimes[key], /^(online|unavailable)$/);
  }
  assert.ok(payload.oracle.day === null || typeof payload.oracle.day === "number");
  assert.ok(Array.isArray(payload.oracle.entries));
  assert.ok(Array.isArray(payload.quest.entries));
  assert.doesNotMatch(body, /"userId"|"discordId"|"walletAddress"/);
});

test("derives current health, search selection, and filtered feature state", async () => {
  const [dashboard, route] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/live/route.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(route, /scope=daily&day=1/);
  assert.match(route, /RUNTIME_SOURCES/);
  assert.match(route, /payload\.entries\.every/);
  assert.match(dashboard, /aria-activedescendant/);
  assert.match(dashboard, /event\.key === "ArrowDown"/);
  assert.match(dashboard, /filteredGames\.find/);
  assert.match(dashboard, /まだ公開記録がありません/);
  assert.match(dashboard, /稼働確認不可/);
  assert.doesNotMatch(dashboard, />5 \/ 5 ONLINE</);
});

test("shares one live contract and keeps re-sync failures non-destructive", async () => {
  const [dashboard, route, contract] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/live/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/live-contract.ts", import.meta.url), "utf8"),
  ]);

  // Server and client import the same payload shape instead of duplicating it.
  assert.match(contract, /export type LiveData/);
  assert.match(dashboard, /from "\.\/live-contract"/);
  assert.match(route, /from "\.\.\/\.\.\/live-contract"/);

  // Upstream protection: snapshot reuse plus single-flight, manual refresh bypass.
  assert.match(route, /SNAPSHOT_TTL_MS/);
  assert.match(route, /inFlightRead/);
  assert.match(route, /searchParams\.has\("refresh"\)/);
  assert.match(route, /MANUAL_REFRESH_COOLDOWN_MS/);
  assert.match(route, /manualRefreshCoolingDown/);

  // A failed re-sync keeps the last verified snapshot instead of wiping it.
  assert.doesNotMatch(dashboard, /setLiveData\(emptyLiveData\)/);
  assert.match(dashboard, /前回の同期結果を表示しています/);

  // Background freshness: visible tabs re-sync, hidden tabs stay quiet.
  assert.match(dashboard, /visibilitychange/);
  assert.match(dashboard, /AUTO_SYNC_INTERVAL_MS/);
});

test("passport endpoints fail closed and identity never comes from the browser", async () => {
  const [passportRoute, callbackRoute, walletLink, adminGrants, adminPlayers, dmAuthLib, authLib] = await Promise.all([
    readFile(new URL("../app/api/passport/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/discord/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/wallet/link/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/grants/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/players/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/discord-dm-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/auth.ts", import.meta.url), "utf8"),
  ]);

  // Session is an HMAC-signed HttpOnly cookie; the Discord ID comes from it.
  assert.match(authLib, /HttpOnly/);
  assert.match(authLib, /SameSite=Lax/);
  assert.match(authLib, /crypto\.subtle\.verify/);
  assert.match(passportRoute, /readSession/);
  assert.doesNotMatch(passportRoute, /searchParams\.get\("discordId"\)/);

  // OAuth callback validates state and exchanges the code server-side.
  assert.match(callbackRoute, /stateClaims\.state !== state/);
  assert.match(callbackRoute, /discord\.com\/api\/oauth2\/token/);

  // DM verification is browser-bound and derives identity only from its D1 challenge.
  assert.match(dmAuthLib, /readCookie\(request, DM_CHALLENGE_COOKIE\)/);
  assert.match(dmAuthLib, /challenge\.discordId/);
  assert.doesNotMatch(dmAuthLib, /body\?\.discordId/);

  // Wallet link requires a signature over a server-issued challenge.
  assert.match(walletLink, /verifyMessage/);
  assert.match(walletLink, /WALLET_TAKEN/);

  // Grants are admin-only, idempotent, append-only.
  assert.match(adminGrants, /await adminDiscordIds\(\)\)\.has\(session\.sub\)/);
  assert.match(adminPlayers, /isHighAssuranceSession\(session\)/);
  assert.match(passportRoute, /isHighAssuranceSession\(session\)/);
  assert.match(adminGrants, /idempotencyKey/);
  assert.doesNotMatch(adminGrants, /\.delete\(|\.update\(/);
});

test("fails closed for anonymous passport and gacha reads without bindings", async () => {
  const response = await render("/api/passport");
  assert.equal(response.status, 401);
  const payload = JSON.parse(await response.text());
  assert.equal(payload.connected, false);
  assert.equal(payload.authConfigured, false);
  assert.deepEqual(payload.authMethods, { oauth: false, dmOtp: false });

  const gacha = await render("/api/gacha");
  assert.equal(gacha.status, 401);
  assert.equal(JSON.parse(await gacha.text()).code, "NOT_AUTHENTICATED");
});

test("degrades image optimization gracefully without Cloudflare bindings", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `image-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/_vinext/image?url=%2Fdashboard-art%2Fmy-sgg-key-visual-v002.png&w=1080&q=75"),
    {},
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/dashboard-art/my-sgg-key-visual-v002.png");

  const rejected = await worker.fetch(
    new Request("http://localhost/_vinext/image?url=https%3A%2F%2Fevil.example%2Fx.png"),
    {},
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(rejected.status, 400);

  for (const source of ["/\\\\evil.example/x.png", "/%5C%5Cevil.example/x.png"]) {
    const encoded = encodeURIComponent(source);
    const backslashRedirect = await worker.fetch(
      new Request(`http://localhost/_vinext/image?url=${encoded}`),
      {},
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(backslashRedirect.status, 400);
    assert.equal(backslashRedirect.headers.get("location"), null);
  }
});

test("keeps publication claims aligned with the deployment registry", async () => {
  const data = await readFile(new URL("../app/dashboard-data.ts", import.meta.url), "utf8");
  assert.match(data, /otomo-farm-77\.vercel\.app/);
  // Only OTOMO CHAIN 7 and OTOMO FARM 77 are being taken to market; every
  // other built title reads 休眠中 rather than claiming a release state.
  assert.match(data, /id: "otomo-chain-7"[\s\S]*?releaseState: "LIVE"/);
  assert.match(data, /id: "otomo-farm-77"[\s\S]*?releaseState: "LIVE"/);
  for (const dormant of ["otomo-quest-77", "otomo-oracle-7", "taiyo-action-rpg", "ebisu-fishing-77"]) {
    assert.match(data, new RegExp(`id: "${dormant}"[\\s\\S]*?releaseState: "DORMANT"`));
  }
  assert.doesNotMatch(data, /id: "taiyo-action-rpg"[\s\S]*?releaseLabel: "PUBLIC RUNTIME/);
  // Every title carries key art on the play surface (owner direction 2026-07-28).
  for (const withArt of ["otomo-quest-77", "otomo-chain-7", "otomo-farm-77", "otomo-oracle-7", "taiyo-action-rpg", "ebisu-fishing-77"]) {
    assert.match(data, new RegExp(`id: "${withArt}"[^}]*?keyArt: "/dashboard-art/`));
  }
});

test("ships the finished visual surface and retires legacy demo art", async () => {
  const swarm = await readFile(new URL("../app/OtomoSwarm.tsx", import.meta.url), "utf8");
  const og = await readFile(new URL("../public/my-sgg-social-og-v002.png", import.meta.url));
  assert.match(swarm, /SWARM_ENABLED = false/);
  assert.equal(og.toString("ascii", 1, 4), "PNG");
  assert.equal(og.readUInt32BE(16), 1200);
  assert.equal(og.readUInt32BE(20), 630);

  await access(new URL("../public/dashboard-art/my-sgg-key-visual-v002.png", import.meta.url));
  await access(new URL("../public/my-sgg-icon-v003.png", import.meta.url));
  await access(new URL("../app/Dashboard.module.css", import.meta.url));
  await access(new URL("../docs/PLAYER_OS_ARCHITECTURE.md", import.meta.url));
  await assert.rejects(access(new URL("../app/CharacterDeck.tsx", import.meta.url)));
  await assert.rejects(access(new URL("../public/og.png", import.meta.url)));
  await assert.rejects(access(new URL("../public/my-sgg-icon-v002.png", import.meta.url)));
  await assert.rejects(access(new URL("../public/dashboard-art/my-sgg-triform-candidate-v1.png", import.meta.url)));
  await assert.rejects(access(new URL("../public/dashboard-art/hero-taimaru-command.png", import.meta.url)));
  await assert.rejects(access(new URL("../public/dashboard-characters", import.meta.url)));
});

test("keeps the starter preview removed", async () => {
  await assert.rejects(access(new URL("app/_sites-preview", root)));
});
