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
  // Home is now the hero stage plus the quick-access card row (owner direction
  // 2026-07-30): the topbar, LIVE SOURCES banner, いま戻る場所, 公開済み
  // アップデート and the right rail were all removed. Per-title status lives in
  // プレイ, so home no longer names individual games server-side.
  assert.match(html, /公開中のゲーム/);
  // The home tournament card used to hardcode 開催中の大会 / 準備中 while a real
  // tournament ran and ended behind it. It now reports the live season, or the
  // count of confirmed records when nothing is running — never "準備中".
  assert.match(html, /TOURNAMENT/);
  assert.doesNotMatch(html, /公開後にここへ表示されます/);
  assert.doesNotMatch(html, /ゲーム側ブリッジ待ち/);
  assert.doesNotMatch(html, /いま戻る場所/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /property="og:image" content="http:\/\/localhost(?::3000)?\/my-sgg-social-og-v004\.jpg"/);
  assert.match(html, /name="twitter:image" content="http:\/\/localhost(?::3000)?\/my-sgg-social-og-v004\.jpg"/);
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

  // The in-game asset bridge / asset source shelf was removed from the
  // collection view entirely (owner direction 2026-07-30), so its honest
  // empty-state copy is no longer required to ship.
  // The TRUSTED LEDGER card grid and SGG Token boundary note were removed from
  // マイSGG (owner direction 2026-07-30); the system definitions remain in
  // dashboard-data.ts as canon documentation.
  // アリーナ carries the live season and standings again (2026-08-07): a
  // tournament was running while the view still said 準備中, so the placeholder
  // copy must NOT ship. What must ship is the honest provenance line.
  for (const value of [
    "順位と得点はゲーム側の公開APIがそのまま出典です",
    "COMMUNITY / OFFICIAL SIGNALS",
    "RAW GAMEPLAY SCORE",
    "SGG_GAME_POINTS",
  ]) assert.match(source, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.doesNotMatch(source, /ZEN_TARO|0x7E7A|ORACLE OPEN|SUMMER CIRCUIT|WEEKEND CUP|KAMIZA 7/);
  assert.doesNotMatch(source, /1,284 PLAYING|842 PLAYING|396 IN ROOM|3,000 SGG_GAME_POINTS POOL/);
  assert.doesNotMatch(source, /GODS AUCTION 7|OTOMO CASCADE 7|SEVENGODS TREE 777/);
  assert.doesNotMatch(source, /4,277|12,840|MYTHIC|EPIC|RARE/);
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
  // SDT holdings are live from the linked wallet; community score remains 実装予定.
  assert.match(data, /SDT \/ SEVENDAO TOKEN/);
  assert.match(data, /コミュニティ指標は実装予定/);
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
  assert.equal(typeof payload.runtimeOnlineCount, "number");
  // The total travels with the payload rather than being hardcoded in the UI,
  // so adopting a title cannot leave the header reading "n / 5".
  assert.equal(typeof payload.runtimeTotal, "number");
  assert.equal(payload.runtimeTotal, Object.keys(payload.runtimes).length);
  assert.ok(payload.runtimeOnlineCount >= 0 && payload.runtimeOnlineCount <= payload.runtimeTotal);
  for (const key of ["chain", "farm", "raid", "market"]) {
    assert.match(payload.runtimes[key], /^(online|unavailable)$/);
  }
  assert.ok(Array.isArray(payload.chain.entries));
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
  // Global search was removed with the topbar (owner direction 2026-07-30),
  // so its combobox accessibility contract no longer applies.
  // The featured/library split was removed (owner direction 2026-07-30): the
  // filter alone decides which titles the play view lists, at one shared size.
  // The three release-state chips were removed (owner direction 2026-08-26):
  // two of them led only to titles nobody can play. One list, playable first.
  assert.match(dashboard, /orderedGames\.map/);
  assert.doesNotMatch(dashboard, /gameFilter/);
  assert.doesNotMatch(dashboard, /ゲーム公開状態フィルター/);
  // アリーナ renders the live season rather than a placeholder, and says so
  // only when the upstream actually answered.
  assert.match(dashboard, /liveData\.chainSeason \? \(/);
  assert.match(dashboard, /liveData\.chain\.entries\.length > 0/);
  assert.doesNotMatch(dashboard, /大会の受付・締切・戦績と、ゲームごとの番付をここに表示します/);
  assert.match(dashboard, /稼働確認不可/);

  // Hardcoded status strings that contradicted live state (2026-08-19 audit):
  // the sidebar claimed NOT CONNECTED for signed-in players while the passport
  // header said CONNECTED, and the vault stat said 未接続 above a rendered
  // wallet. Both now read from the same state the rest of the view uses.
  assert.doesNotMatch(dashboard, /PLAYER DATA BRIDGE · NOT CONNECTED/);
  assert.match(dashboard, /<small>\{passportBridgeLabel\}<\/small>/);
  assert.doesNotMatch(dashboard, /<b>未接続<\/b>MY ASSETS/);
  // The gacha currency is 勾玉 in the ledger; "Gコイン" never existed.
  assert.doesNotMatch(dashboard, /Gコイン/);
  // Grant timestamps and season dates must share one timezone, or a player
  // reads their own award an hour off from the tournament that produced it.
  assert.doesNotMatch(dashboard, /Asia\/Kuala_Lumpur/);
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
    new Request("http://localhost/_vinext/image?url=%2Fdashboard-art%2Fmy-sgg-key-visual-v002.webp&w=1080&q=75"),
    {},
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/dashboard-art/my-sgg-key-visual-v002.webp");

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
  // FARM moved to its own subdomain; the vercel deployment now 404s, so the
  // old host must not come back in a link or a health check.
  assert.match(data, /otomofarm\.sevengodsgames\.com/);
  assert.doesNotMatch(data, /otomo-farm-77\.vercel\.app/);
  // Only OTOMO CHAIN 7 and OTOMO FARM 77 are being taken to market; every
  // other built title reads 休眠中 rather than claiming a release state.
  // FARM is closed for rework (工事中, owner direction 2026-07-31): still on
  // the front shelf, but its play links are withheld.
  assert.match(data, /id: "otomo-chain-7"[\s\S]*?releaseState: "LIVE"/);
  // FARM came back: otomofarm.sevengodsgames.com was serving Day 11 of a live
  // 77-day season while the dashboard still wrapped it in construction tape.
  assert.match(data, /id: "otomo-farm-77"[\s\S]*?releaseState: "LIVE"/);
  // The catalogue is the four adopted titles and nothing else (owner
  // direction 2026-08-26): QUEST, ORACLE, TAIYO and EBISU were dropped rather
  // than left on screen as 休眠中 shelf-filler.
  assert.match(data, /id: "oedo-market-7"[\s\S]*?releaseState: "LIVE"/);
  assert.match(data, /id: "otomo-raid-7"[\s\S]*?releaseState: "LIVE"/);
  for (const gone of ["otomo-quest-77", "otomo-oracle-7", "taiyo-action-rpg", "ebisu-fishing-77"]) {
    assert.doesNotMatch(data, new RegExp(`id: "${gone}"`));
  }
  // Every title carries key art on the play surface (owner direction 2026-07-28).
  // CHAIN and FARM ship approved art; MARKET and RAID have none yet and fall
  // back to the glyph rather than borrowing another project's images.
  for (const withArt of ["otomo-chain-7", "otomo-farm-77"]) {
    assert.match(data, new RegExp(`id: "${withArt}"[^}]*?keyArt: "/dashboard-art/`));
  }
});

test("ships the finished visual surface and retires legacy demo art", async () => {
  const swarm = await readFile(new URL("../app/OtomoSwarm.tsx", import.meta.url), "utf8");
  const og = await readFile(new URL("../public/my-sgg-social-og-v004.jpg", import.meta.url));
  assert.match(swarm, /SWARM_ENABLED = false/);
  // JPEG now: read the SOF marker rather than a PNG IHDR, and keep asserting
  // the real 1200x630 so a mis-cropped card cannot ship.
  assert.equal(og.readUInt16BE(0), 0xffd8, "share card must be a JPEG");
  const sof = (() => {
    for (let i = 2; i < og.length - 9; ) {
      if (og[i] !== 0xff) { i += 1; continue; }
      const marker = og[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: og.readUInt16BE(i + 5), width: og.readUInt16BE(i + 7) };
      }
      i += 2 + og.readUInt16BE(i + 2);
    }
    return null;
  })();
  assert.ok(sof, "share card SOF marker not found");
  assert.equal(sof.width, 1200);
  assert.equal(sof.height, 630);
  // A share card is fetched by every unfurling scraper; keep it lean.
  assert.ok(og.length < 700_000, `share card is ${og.length} bytes`);

  await access(new URL("../public/dashboard-art/my-sgg-key-visual-v002.webp", import.meta.url));
  await access(new URL("../public/my-sgg-icon-v004.png", import.meta.url));

  // Runtime art ships as WebP (2026-08-26): the PNG set was 42MB and a phone
  // paid 7MB a visit for it. Icons stay PNG/ICO because browsers and iOS
  // home screens need them, but nothing under dashboard-art may regress.
  const { readdir } = await import("node:fs/promises");
  const artFiles = await readdir(new URL("../public/dashboard-art", import.meta.url), { recursive: true });
  const strayPng = artFiles.filter((name) => String(name).endsWith(".png"));
  assert.deepEqual(strayPng, [], `dashboard art must be WebP: ${strayPng.join(", ")}`);

  // public/_headers overrides the generated one, so it must keep the hashed
  // bundle rule as well as the art caching it was added for.
  const headers = await readFile(new URL("../public/_headers", import.meta.url), "utf8");
  assert.match(headers, /\/assets\/\*\n\s*Cache-Control: public, max-age=31536000, immutable/);
  assert.match(headers, /\/dashboard-art\/\*\n\s*Cache-Control: public, max-age=\d+/);
  await access(new URL("../public/apple-touch-icon.png", import.meta.url));
  await access(new URL("../public/favicon.ico", import.meta.url));
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

test("the arena lists only boards for titles that are actually running", async () => {
  const { games, liveCompetitions } = await import("../app/dashboard-data.ts");
  const dashboard = await readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8");

  // Every listed board belongs to a LIVE title. A dormant game's ranking
  // endpoint keeps answering (ORACLE still serves a day-1 table from July),
  // so release state — not endpoint reachability — decides what is listed.
  for (const competition of liveCompetitions) {
    const game = games.find((entry) => entry.id === competition.gameId);
    assert.ok(game, `${competition.id} points at an unknown game`);
    assert.equal(game.releaseState, "LIVE", `${competition.id} is listed while ${game.title} is ${game.releaseState}`);
  }
  // CHAIN runs the tournaments; it must never be the missing one.
  assert.ok(
    liveCompetitions.some((competition) => competition.gameId === "otomo-chain-7"),
    "OTOMO CHAIN 7 must be listed among the boards",
  );
  assert.match(dashboard, /liveCompetitions\.map/);
  assert.doesNotMatch(dashboard, /competitions\.map/);

  // The headline standings come from CHAIN, not from a dormant title.
  assert.match(dashboard, /liveData\.chain\.entries\.length > 0/);
  assert.doesNotMatch(dashboard, /liveData\.oracle\.entries\.map/);
  assert.doesNotMatch(dashboard, /神託番付 DAY/);
});

test("a free-play route is only advertised where it was actually confirmed", async () => {
  const { games } = await import("../app/dashboard-data.ts");
  const dashboard = await readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8");

  for (const game of games) {
    if (!game.freePlay) continue;
    // Nothing can be tried without somewhere to try it, and a title that is
    // closed for rework must not invite play at all.
    assert.ok(game.officialUrl, `${game.id} offers free play with no URL to reach it`);
    assert.notEqual(game.releaseState, "MAINTENANCE", `${game.id} is 工事中 and cannot be played`);
    assert.ok(game.freePlay.label.trim(), `${game.id} free-play label is empty`);
    // The note carries the real terms, so the invitation cannot read as a
    // promise that the run counts towards a ranking.
    assert.ok(game.freePlay.note.trim(), `${game.id} free-play note must state the terms`);
  }
  assert.ok(games.some((game) => game.freePlay), "at least one title is playable between tournaments");
  assert.match(dashboard, /game\.freePlay && game\.officialUrl/);
  assert.match(dashboard, /大会がなくても今すぐ試せます/);
});

test("every live title's health check is actually wired to it", async () => {
  const { games } = await import("../app/dashboard-data.ts");
  const dashboard = await readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/live/route.ts", import.meta.url), "utf8");

  const mapping = dashboard.slice(dashboard.indexOf("const runtimeKeyByGameId"));
  for (const game of games) {
    if (game.releaseState !== "LIVE") continue;
    // A LIVE title with no mapping renders 稼働確認不可 forever while its
    // server answers fine — the card would report an outage that isn't real.
    assert.match(mapping.slice(0, mapping.indexOf("};")), new RegExp(`"${game.id}"`),
      `${game.id} is LIVE but has no runtime key`);
  }
  // And every key the dashboard reads must be a runtime the route checks.
  for (const key of ["chain", "farm", "raid", "market"]) {
    assert.match(route, new RegExp(`\\n  ${key}: "https`), `${key} is not checked by /api/live`);
  }
});
