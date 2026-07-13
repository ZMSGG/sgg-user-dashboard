import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the SGG dashboard starter", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /MY SGG/);
  assert.match(html, /挑戦のすべてを/);
  assert.match(html, /大会出場/);
  assert.match(html, /優勝回数/);
  assert.match(html, /STARTER KIT/);
  assert.match(html, /DEMO DATA/);
  assert.match(html, /property="og:image" content="http:\/\/localhost:3000\/og\.png"/);
  assert.match(html, /name="twitter:image" content="http:\/\/localhost:3000\/og\.png"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps canonical asset and point vocabulary separated", async () => {
  const [dashboard, data, readme] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);
  const source = `${dashboard}\n${data}\n${readme}`;

  assert.match(source, /SGG Token/i);
  assert.match(source, /SGG_GAME_POINTS/);
  assert.match(source, /精霊体/);
  assert.match(source, /受肉体/);
  assert.match(source, /童子/);
  assert.match(source, /SEVENGODS/);
  assert.match(source, /SGG Tokenとは別/);
  assert.doesNotMatch(source, /獣獣体|INCARNATED|\bSDG\b/);
});

test("removes the disposable starter preview", async () => {
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});
