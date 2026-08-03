import test from "node:test";
import assert from "node:assert/strict";

import { fetchGuildMember } from "../server/discord-guild.ts";

const GUILD_ID = "1".repeat(18);
const DISCORD_ID = "2".repeat(18);
const ROLE_ID = "3".repeat(18);
const CONFIG = {
  botToken: "test-bot-token-".padEnd(60, "x"),
  guildId: GUILD_ID,
};
const MEMBER_URL =
  `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${DISCORD_ID}`;

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(t, responses) {
  let index = 0;
  return t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, MEMBER_URL);
    assert.equal(init.headers.authorization, `Bot ${CONFIG.botToken}`);
    assert.equal(init.redirect, "manual");
    assert.ok(init.signal instanceof AbortSignal);
    const response = responses[index++];
    if (response instanceof Error) throw response;
    return response;
  });
}

test("guild sync accepts a well-formed 200 member for the requested user", async (t) => {
  const fetchMock = mockFetch(t, [jsonResponse({
    user: { id: DISCORD_ID, username: "player" },
    joined_at: "2026-07-21T03:04:05.000Z",
    roles: [ROLE_ID],
  }, 200)]);

  assert.deepEqual(await fetchGuildMember(CONFIG, DISCORD_ID), {
    member: true,
    joinedAt: "2026-07-21T03:04:05.000Z",
    roles: [ROLE_ID],
  });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("guild sync maps only Discord's confirmed Unknown Member error to false", async (t) => {
  mockFetch(t, [jsonResponse({
    code: 10007,
    message: "Unknown Member",
  }, 404)]);

  assert.deepEqual(await fetchGuildMember(CONFIG, DISCORD_ID), {
    member: false,
    joinedAt: null,
    roles: [],
  });
});

test("guild sync fails closed for invalid-guild and ambiguous 404 responses", async (t) => {
  mockFetch(t, [
    jsonResponse({ code: 10004, message: "Unknown Guild" }, 404),
    jsonResponse({ code: 0, message: "Not Found" }, 404),
    new Response("not found", { status: 404 }),
    jsonResponse({ code: 10007, message: "Unknown Guild" }, 404),
  ]);

  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID), null);
  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID), null);
  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID), null);
  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID), null);
});

test("guild sync fails closed for authorization, rate-limit, and server errors", async (t) => {
  mockFetch(t, [403, 429, 500, 502, 503].map((status) =>
    jsonResponse({ code: status === 403 ? 50001 : 0, message: "upstream failure" }, status)
  ));

  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID), null);
  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID), null);
  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID), null);
  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID), null);
  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID), null);
});

test("guild sync fails closed on timeout and does not fetch invalid identifiers", async (t) => {
  const fetchMock = mockFetch(t, [new Error("request timed out")]);

  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID, 1), null);
  assert.equal(await fetchGuildMember({ ...CONFIG, guildId: "invalid" }, DISCORD_ID), null);
  assert.equal(await fetchGuildMember(CONFIG, "invalid"), null);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("guild sync rejects malformed or identity-mismatched 200 payloads", async (t) => {
  mockFetch(t, [
    new Response("{", { status: 200, headers: { "content-type": "application/json" } }),
    jsonResponse({ joined_at: null, roles: [] }, 200),
    jsonResponse({ user: { id: "4".repeat(18) }, joined_at: null, roles: [] }, 200),
    jsonResponse({ user: { id: DISCORD_ID }, joined_at: null, roles: "not-an-array" }, 200),
    jsonResponse({ user: { id: DISCORD_ID }, joined_at: null, roles: ["invalid"] }, 200),
    jsonResponse({ user: { id: DISCORD_ID }, joined_at: "not-a-date", roles: [] }, 200),
  ]);

  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID), null);
  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID), null);
  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID), null);
  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID), null);
  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID), null);
  assert.equal(await fetchGuildMember(CONFIG, DISCORD_ID), null);
});

// Regression guard for a bug that shipped because the unit tests above mock
// fetch with Node's implementation, where redirect: "error" is legal. workerd
// implements only "follow" and "manual" and throws on anything else *before*
// sending the request, so every Bot-token call failed in production while the
// suite stayed green. Scan the real sources rather than a mock.
test("every fetch redirect mode is one workerd implements", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const roots = ["server", "worker", "app"];
  const allowed = new Set(["follow", "manual"]);
  const offenders = [];

  const walk = async (dir) => {
    for (const entry of await readdir(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
      const child = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(child);
      else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) {
        const source = await readFile(new URL(`../${child}`, import.meta.url), "utf8");
        for (const [, mode] of source.matchAll(/redirect:\s*"([^"]+)"/g)) {
          if (!allowed.has(mode)) offenders.push(`${child}: ${mode}`);
        }
      }
    }
  };

  await walk(roots[0]);
  await walk(roots[1]);
  await walk(roots[2]);
  assert.deepEqual(offenders, []);
});
