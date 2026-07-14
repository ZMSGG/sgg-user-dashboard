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
  assert.match(html, /QUEST 77/);
  assert.match(html, /FARM 77/);
  assert.match(html, /ORACLE 7/);
  assert.match(html, /TAIYO/);
  assert.match(html, /公開確認済みのゲーム・ランキング・投稿だけを表示/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /property="og:image" content="http:\/\/localhost(?::3000)?\/og\.png"/);
  assert.match(html, /name="twitter:image" content="http:\/\/localhost(?::3000)?\/og\.png"/);
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
    "あなたの保有データはまだ接続されていません",
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
  assert.equal(typeof payload.sources.oracle, "string");
  assert.equal(typeof payload.sources.quest, "string");
  assert.equal(typeof payload.runtimeOnlineCount, "number");
  assert.ok(payload.runtimeOnlineCount >= 0 && payload.runtimeOnlineCount <= 4);
  for (const key of ["oracle", "quest", "farm", "taiyo"]) {
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
  assert.doesNotMatch(dashboard, />4 \/ 4 ONLINE</);
});

test("ships the finished visual surface and retires legacy demo art", async () => {
  const og = await readFile(new URL("../public/og.png", import.meta.url));
  assert.equal(og.toString("ascii", 1, 4), "PNG");
  assert.equal(og.readUInt32BE(16), 1200);
  assert.equal(og.readUInt32BE(20), 630);

  await access(new URL("../public/dashboard-art/my-sgg-triform-candidate-v1.png", import.meta.url));
  await access(new URL("../app/Dashboard.module.css", import.meta.url));
  await access(new URL("../docs/PLAYER_OS_ARCHITECTURE.md", import.meta.url));
  await assert.rejects(access(new URL("../app/CharacterDeck.tsx", import.meta.url)));
  await assert.rejects(access(new URL("../public/dashboard-art/hero-taimaru-command.png", import.meta.url)));
  await assert.rejects(access(new URL("../public/dashboard-characters", import.meta.url)));
});

test("keeps the starter preview removed", async () => {
  await assert.rejects(access(new URL("app/_sites-preview", root)));
});
