import assert from "node:assert/strict";
import test from "node:test";

import { SqliteD1Database, applyProjectMigrations } from "./helpers/sqlite-d1.mjs";

await import("tsx/esm");

const {
  DM_CHALLENGE_COOKIE,
  DM_CODE_LENGTH,
  discordDmAuthConfigFromEnv,
  discordDmCodeDigest,
  discordDmRateSubjectDigest,
  findDiscordDmGuildMember,
  generateDiscordDmCode,
  handleDiscordDmStart,
  handleDiscordDmVerify,
  normalizeCfConnectingIp,
  normalizeDiscordIdentity,
} = await import("../server/discord-dm-auth.ts");
const {
  createSessionArtifact,
  hasRecentAuthentication,
  sha256Hex,
} = await import("../server/auth.ts");

const SESSION_SECRET = "session-secret-For-Tests!234567890-ABCDEFG";
const OTP_PEPPER = "separate-dm-pepper-For-Tests!987654321-ZYXWV";
const BOT_TOKEN = "test-bot-token-material-that-is-never-sent-123456";
const GUILD_ID = "1525384497892163714";
const DISCORD_ID = "300000000000000001";
const OTHER_ID = "300000000000000002";
const APP_ORIGIN = "https://player.example";
const NOW = 2_000_000_000;

function memberPayload(id = DISCORD_ID, username = "caseuser", overrides = {}) {
  const { user: userOverrides = {}, ...memberOverrides } = overrides;
  return {
    user: {
      id,
      username,
      global_name: "Case User",
      avatar: "avatar_hash_123",
      ...userOverrides,
    },
    roles: ["400000000000000001"],
    joined_at: "2026-07-20T00:00:00.000Z",
    ...memberOverrides,
  };
}

function envFor(db) {
  return {
    DB: db,
    APP_ORIGIN,
    SESSION_SECRET,
    DISCORD_BOT_TOKEN: BOT_TOKEN,
    DISCORD_GUILD_ID: GUILD_ID,
    DM_OTP_PEPPER: OTP_PEPPER,
  };
}

async function fixture(t) {
  const client = new SqliteD1Database();
  await applyProjectMigrations(client.sqlite);
  t.after(() => client.close());
  return { client, env: envFor(client) };
}

function mutationRequest(path, body, headers = {}) {
  return new Request(`${APP_ORIGIN}${path}`, {
    method: "POST",
    headers: {
      origin: APP_ORIGIN,
      "content-type": "application/json",
      "x-sgg-request": "1",
      "cf-connecting-ip": "203.0.113.7",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function scheduledStart(overrides = {}) {
  const tasks = [];
  return {
    dependencies: {
      ...overrides,
      schedule: (task) => { tasks.push(task); },
    },
    get count() { return tasks.length; },
    async drain() { await Promise.all(tasks); },
  };
}

function cookieValue(response, name) {
  const header = response.headers.get("set-cookie") ?? "";
  return new RegExp(`(?:^|[, ]+)${name}=([^;]+)`).exec(header)?.[1] ?? null;
}

function fullDiscordMock() {
  const calls = [];
  let deliveredCode = null;
  const fetcher = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    assert.equal(init.redirect, "error");
    assert.ok(init.signal instanceof AbortSignal);
    if (url.includes("/members/search?")) {
      return Response.json([memberPayload()]);
    }
    if (url.endsWith(`/members/${DISCORD_ID}`)) {
      return Response.json(memberPayload());
    }
    if (url.endsWith("/users/@me/channels")) {
      assert.deepEqual(JSON.parse(init.body), { recipient_id: DISCORD_ID });
      return Response.json({ id: "500000000000000001" });
    }
    if (url.endsWith("/channels/500000000000000001/messages")) {
      const body = JSON.parse(init.body);
      deliveredCode = /\*\*([0-9A-HJKMNP-TV-Z]{10})\*\*/.exec(body.content)?.[1] ?? null;
      return Response.json({
        id: "600000000000000001",
        channel_id: "500000000000000001",
      });
    }
    throw new Error(`Unexpected Discord request: ${url}`);
  };
  return { calls, fetcher, get deliveredCode() { return deliveredCode; } };
}

test("DM config is OAuth-independent and requires a distinct strong OTP pepper", () => {
  const DB = {};
  assert.ok(discordDmAuthConfigFromEnv(envFor(DB)));
  assert.equal(discordDmAuthConfigFromEnv({ ...envFor(DB), DM_OTP_PEPPER: SESSION_SECRET }), null);
  assert.equal(discordDmAuthConfigFromEnv({ ...envFor(DB), DM_OTP_PEPPER: BOT_TOKEN }), null);
  assert.equal(discordDmAuthConfigFromEnv({
    ...envFor(DB),
    DISCORD_CLIENT_SECRET: OTP_PEPPER,
  }), null);
  assert.equal(discordDmAuthConfigFromEnv({
    ...envFor(DB),
    INTEGRATION_GRANT_SECRET: OTP_PEPPER,
  }), null);
  assert.equal(discordDmAuthConfigFromEnv({ ...envFor(DB), DM_OTP_PEPPER: "weak" }), null);
  assert.equal(discordDmAuthConfigFromEnv({ ...envFor(DB), DISCORD_BOT_TOKEN: "short" }), null);
  assert.equal(discordDmAuthConfigFromEnv({ ...envFor(DB), DISCORD_GUILD_ID: "guild" }), null);
});

test("identity, IP, code alphabet, and HMAC domains normalize without ambiguity", async () => {
  assert.deepEqual(normalizeDiscordIdentity(`@CaseUser`), { kind: "username", value: "CaseUser" });
  assert.deepEqual(normalizeDiscordIdentity(DISCORD_ID), { kind: "id", value: DISCORD_ID });
  assert.equal(normalizeDiscordIdentity("@bad name"), null);
  assert.equal(normalizeCfConnectingIp("203.0.113.007"), "203.0.113.7");
  assert.equal(normalizeCfConnectingIp("2001:DB8::1"), "2001:db8::1");
  assert.equal(normalizeCfConnectingIp("999.1.1.1"), null);
  assert.equal(normalizeCfConnectingIp("not-an-ip"), null);

  const codes = new Set(Array.from({ length: 128 }, () => generateDiscordDmCode()));
  assert.ok(codes.size > 120);
  for (const code of codes) {
    assert.equal(code.length, DM_CODE_LENGTH);
    assert.match(code, /^[0-9A-HJKMNP-TV-Z]{10}$/);
    assert.doesNotMatch(code, /[ILOU]/);
  }

  const base = await discordDmCodeDigest(OTP_PEPPER, "a".repeat(64), DISCORD_ID, "23456789AB");
  assert.match(base, /^[0-9a-f]{64}$/);
  assert.notEqual(
    base,
    await discordDmCodeDigest(OTP_PEPPER, "b".repeat(64), DISCORD_ID, "23456789AB"),
  );
  assert.notEqual(
    base,
    await discordDmCodeDigest(OTP_PEPPER, "a".repeat(64), OTHER_ID, "23456789AB"),
  );
  assert.notEqual(
    await discordDmRateSubjectDigest(OTP_PEPPER, "ip", "203.0.113.7"),
    await discordDmRateSubjectDigest(OTP_PEPPER, "discord", "203.0.113.7"),
  );
  assert.notEqual(
    await discordDmRateSubjectDigest(OTP_PEPPER, "global", "discord-dm-start"),
    await discordDmRateSubjectDigest(OTP_PEPPER, "ip", "discord-dm-start"),
  );
  await assert.rejects(createSessionArtifact(SESSION_SECRET, DISCORD_ID, NOW, {
    ttlSeconds: 86_401,
    authentication: { authMethod: "discord_dm", assuranceLevel: 1 },
  }), /authentication context is invalid/);
  await assert.rejects(createSessionArtifact(SESSION_SECRET, DISCORD_ID, NOW, {
    authentication: { authMethod: "unrecognized", assuranceLevel: 1 },
  }), /authentication context is invalid/);
});

test("guild lookup accepts one exact case-insensitive username and fails closed otherwise", async () => {
  const config = discordDmAuthConfigFromEnv(envFor({}));
  assert.ok(config);
  let observedUrl = "";
  const exact = await findDiscordDmGuildMember(
    config,
    normalizeDiscordIdentity("@CASEUSER"),
    async (input, init) => {
      observedUrl = String(input);
      assert.equal(init.redirect, "error");
      return Response.json([memberPayload(), memberPayload(OTHER_ID, "caseuser-prefix")]);
    },
  );
  assert.equal(exact?.id, DISCORD_ID);
  assert.match(observedUrl, /\/api\/v10\/guilds\//);
  assert.match(observedUrl, /query=CASEUSER/);
  assert.match(observedUrl, /limit=100/);

  const ambiguous = await findDiscordDmGuildMember(
    config,
    normalizeDiscordIdentity("caseuser"),
    async () => Response.json([
      memberPayload(DISCORD_ID, "caseuser"),
      memberPayload(OTHER_ID, "CaseUser"),
    ]),
  );
  assert.equal(ambiguous, null);

  const malformed = await findDiscordDmGuildMember(
    config,
    normalizeDiscordIdentity("caseuser"),
    async () => Response.json([
      memberPayload(),
      memberPayload(OTHER_ID, "other", { roles: [123] }),
    ]),
  );
  assert.equal(malformed, null);

  const bot = await findDiscordDmGuildMember(
    config,
    normalizeDiscordIdentity("caseuser"),
    async () => Response.json([memberPayload(DISCORD_ID, "caseuser", { user: { bot: true } })]),
  );
  assert.equal(bot, null);

  const mismatch = await findDiscordDmGuildMember(
    config,
    normalizeDiscordIdentity(DISCORD_ID),
    async () => Response.json(memberPayload(OTHER_ID)),
  );
  assert.equal(mismatch, null);
  assert.equal(await findDiscordDmGuildMember(
    config,
    normalizeDiscordIdentity(DISCORD_ID),
    async () => { throw new Error("timeout"); },
  ), null);
  assert.equal(await findDiscordDmGuildMember(
    config,
    normalizeDiscordIdentity(DISCORD_ID),
    async () => new Response("<html>not json</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    }),
  ), null);
});

test("start is same-origin JSON only and remains enumeration resistant", async (t) => {
  const { client, env } = await fixture(t);
  let fetchCalls = 0;
  const rejected = await handleDiscordDmStart(new Request(
    `${APP_ORIGIN}/api/auth/discord/dm/start`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-sgg-request": "1" },
      body: JSON.stringify({ identity: "caseuser" }),
    },
  ), env, {
    nowSeconds: NOW,
    fetcher: async () => { fetchCalls += 1; throw new Error("must not fetch"); },
  });
  assert.equal(rejected.status, 403);
  assert.equal(fetchCalls, 0);

  const unavailable = await handleDiscordDmStart(
    mutationRequest("/api/auth/discord/dm/start", { identity: "caseuser" }),
    env,
    {
      nowSeconds: NOW,
      fetcher: async () => { fetchCalls += 1; throw new Error("must not fetch"); },
    },
  );
  assert.equal(unavailable.status, 503);
  assert.equal(fetchCalls, 0);

  const scheduled = scheduledStart({
    nowSeconds: NOW,
    fetcher: async () => { fetchCalls += 1; throw new Error("must not fetch"); },
  });
  const invalid = await handleDiscordDmStart(
    mutationRequest("/api/auth/discord/dm/start", { identity: "unknown user" }),
    env,
    scheduled.dependencies,
  );
  assert.equal(invalid.status, 202);
  assert.deepEqual(Object.keys(await invalid.clone().json()).sort(), ["challengeId", "expiresIn", "ok"]);
  assert.equal((await invalid.json()).expiresIn, 300);
  assert.match(invalid.headers.get("set-cookie"), /HttpOnly; SameSite=Strict; Max-Age=300; Secure/);
  assert.equal(fetchCalls, 0);
  assert.equal(scheduled.count, 0);
  assert.equal(
    client.sqlite.prepare("SELECT COUNT(*) AS count FROM discord_dm_challenges").get().count,
    0,
  );
});

test("valid start stores only digests, sends one DM, and verify creates a 24h low-assurance session", async (t) => {
  const { client, env } = await fixture(t);
  const discord = fullDiscordMock();
  let releaseLookup;
  let lookupStarted = false;
  let signalLookupStarted;
  const lookupGate = new Promise((resolve) => { releaseLookup = resolve; });
  const lookupStartedSignal = new Promise((resolve) => { signalLookupStarted = resolve; });
  const scheduled = scheduledStart({
    nowSeconds: NOW,
    fetcher: async (input, init) => {
      if (String(input).includes("/members/search?")) {
        lookupStarted = true;
        signalLookupStarted();
        await lookupGate;
      }
      return discord.fetcher(input, init);
    },
  });
  const start = await Promise.race([
    handleDiscordDmStart(
      mutationRequest("/api/auth/discord/dm/start", { identity: "@CaseUser" }),
      env,
      scheduled.dependencies,
    ),
    new Promise((_, reject) => setTimeout(
      () => reject(new Error("start response waited for Discord")),
      250,
    )),
  ]);
  assert.equal(start.status, 202);
  const startBody = await start.json();
  assert.deepEqual({ ok: startBody.ok, expiresIn: startBody.expiresIn }, { ok: true, expiresIn: 300 });
  assert.match(startBody.challengeId, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(scheduled.count, 1);
  assert.equal(discord.deliveredCode, null);
  await Promise.race([
    lookupStartedSignal,
    new Promise((_, reject) => setTimeout(
      () => reject(new Error("scheduled Discord lookup did not start")),
      500,
    )),
  ]);
  assert.equal(lookupStarted, true);
  assert.equal(discord.deliveredCode, null);
  releaseLookup();
  await scheduled.drain();
  assert.match(discord.deliveredCode, /^[0-9A-HJKMNP-TV-Z]{10}$/);
  const nonce = cookieValue(start, DM_CHALLENGE_COOKIE);
  assert.match(nonce, /^[A-Za-z0-9_-]{43}$/);

  const challenge = client.sqlite.prepare(`
    SELECT challenge_id_digest, client_nonce_digest, code_digest, discord_id,
      expires_at, attempts, consumed_at
    FROM discord_dm_challenges
  `).get();
  assert.equal(challenge.challenge_id_digest, await sha256Hex(startBody.challengeId));
  assert.equal(challenge.client_nonce_digest, await sha256Hex(nonce));
  assert.equal(challenge.discord_id, DISCORD_ID);
  assert.equal(challenge.expires_at, NOW + 300);
  assert.equal(challenge.attempts, 0);
  assert.equal(challenge.consumed_at, null);
  assert.match(challenge.code_digest, /^[0-9a-f]{64}$/);
  assert.notEqual(challenge.code_digest, discord.deliveredCode);
  assert.doesNotMatch(JSON.stringify(
    client.sqlite.prepare("SELECT * FROM discord_dm_rate_limits").all(),
  ), /203\.0\.113\.7/);
  assert.equal(client.sqlite.prepare(`
    SELECT COUNT(*) AS count FROM discord_dm_rate_limits
    WHERE subject_digest = ? OR subject_digest = ?
  `).get("203.0.113.7", DISCORD_ID).count, 0);

  const verify = await handleDiscordDmVerify(
    mutationRequest("/api/auth/discord/dm/verify", {
      challengeId: startBody.challengeId,
      code: discord.deliveredCode,
    }, { cookie: `${DM_CHALLENGE_COOKIE}=${nonce}` }),
    env,
    { nowSeconds: NOW + 10, fetcher: discord.fetcher },
  );
  assert.equal(verify.status, 200);
  assert.deepEqual(await verify.json(), { ok: true });
  const cookies = verify.headers.get("set-cookie") ?? "";
  assert.match(cookies, /sgg_session=/);
  assert.match(cookies, new RegExp(`${DM_CHALLENGE_COOKIE}=;`));
  assert.match(cookies, /Max-Age=86400/);

  const session = client.sqlite.prepare(`
    SELECT discord_id, expires_at, auth_method, assurance_level FROM auth_sessions
  `).get();
  assert.deepEqual({ ...session }, {
    discord_id: DISCORD_ID,
    expires_at: NOW + 10 + 86_400,
    auth_method: "discord_dm",
    assurance_level: 1,
  });
  assert.equal(hasRecentAuthentication({
    sub: DISCORD_ID,
    sessionId: "digest",
    iat: NOW + 10,
    exp: NOW + 10 + 86_400,
    authMethod: "discord_dm",
    assuranceLevel: 1,
  }, 900, NOW + 20), false);
  const audit = client.sqlite.prepare(`
    SELECT detail FROM audit_events WHERE action = 'DISCORD_LOGIN'
  `).get();
  assert.deepEqual(JSON.parse(audit.detail), {
    sessionId: client.sqlite.prepare("SELECT id FROM auth_sessions").get().id.slice(0, 16),
    authMethod: "discord_dm",
    assuranceLevel: 1,
  });
  assert.equal(discord.calls.filter((call) => call.url.includes(`/members/${DISCORD_ID}`)).length, 1);

  const replay = await handleDiscordDmVerify(
    mutationRequest("/api/auth/discord/dm/verify", {
      challengeId: startBody.challengeId,
      code: discord.deliveredCode,
    }, { cookie: `${DM_CHALLENGE_COOKIE}=${nonce}` }),
    env,
    { nowSeconds: NOW + 11, fetcher: discord.fetcher },
  );
  assert.equal(replay.status, 400);
  assert.equal((await replay.json()).code, "DM_AUTH_FAILED");
  assert.match(replay.headers.get("set-cookie"), new RegExp(`${DM_CHALLENGE_COOKIE}=;`));
  assert.equal(client.sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get().count, 1);
});

test("invalid, ambiguous, and DM delivery failures share the same accepted contract", async (t) => {
  const cases = [
    {
      label: "not found",
      searchPayload: [],
      expectedPosts: 0,
    },
    {
      label: "ambiguous",
      searchPayload: [memberPayload(), memberPayload(OTHER_ID, "CaseUser")],
      expectedPosts: 0,
    },
    {
      label: "malformed",
      searchPayload: [memberPayload(DISCORD_ID, "caseuser", { roles: [123] })],
      expectedPosts: 0,
    },
    {
      label: "DM refused",
      searchPayload: [memberPayload()],
      expectedPosts: 1,
    },
  ];

  for (let index = 0; index < cases.length; index += 1) {
    const { label, searchPayload, expectedPosts } = cases[index];
    const client = new SqliteD1Database();
    await applyProjectMigrations(client.sqlite);
    t.after(() => client.close());
    let posts = 0;
    const scheduled = scheduledStart({
      nowSeconds: NOW,
      fetcher: async (input, init = {}) => {
        const url = String(input);
        if (url.includes("/members/search?")) return Response.json(searchPayload);
        if (init.method === "POST") {
          posts += 1;
          return Response.json({ message: "Cannot send messages" }, { status: 403 });
        }
        throw new Error(`Unexpected call for ${label}`);
      },
    });
    const response = await handleDiscordDmStart(
      mutationRequest("/api/auth/discord/dm/start", { identity: "caseuser" }, {
        "cf-connecting-ip": `203.0.113.${index + 10}`,
      }),
      envFor(client),
      scheduled.dependencies,
    );
    assert.equal(response.status, 202, label);
    const body = await response.json();
    assert.equal(body.ok, true, label);
    assert.equal(body.expiresIn, 300, label);
    assert.match(body.challengeId, /^[A-Za-z0-9_-]{32}$/, label);
    await scheduled.drain();
    assert.equal(posts, expectedPosts, label);
    const rows = client.sqlite.prepare(`
      SELECT consumed_at FROM discord_dm_challenges
    `).all();
    if (label === "DM refused") {
      assert.equal(rows.length, 1);
      assert.notEqual(rows[0].consumed_at, null);
    } else {
      assert.equal(rows.length, 0);
    }
  }
});

test("global start circuit breaker caps all source IPs before Discord lookup", async (t) => {
  const { client, env } = await fixture(t);
  let lookups = 0;
  const fetcher = async () => {
    lookups += 1;
    return Response.json([]);
  };
  for (let attempt = 0; attempt < 31; attempt += 1) {
    const scheduled = scheduledStart({ nowSeconds: NOW, fetcher });
    const response = await handleDiscordDmStart(
      mutationRequest("/api/auth/discord/dm/start", { identity: `ghost${attempt}` }, {
        "cf-connecting-ip": `203.0.113.${attempt + 20}`,
      }),
      env,
      scheduled.dependencies,
    );
    assert.equal(response.status, 202);
    assert.equal((await response.json()).ok, true);
    await scheduled.drain();
  }
  assert.equal(lookups, 30);
  const globalRate = client.sqlite.prepare(`
    SELECT attempts, subject_digest FROM discord_dm_rate_limits WHERE scope = 'global'
  `).get();
  assert.equal(globalRate.attempts, 30);
  assert.match(globalRate.subject_digest, /^[0-9a-f]{64}$/);

  const resetScheduled = scheduledStart({ nowSeconds: NOW + 60, fetcher });
  const reset = await handleDiscordDmStart(
    mutationRequest("/api/auth/discord/dm/start", { identity: "ghostreset" }, {
      "cf-connecting-ip": "203.0.113.99",
    }),
    env,
    resetScheduled.dependencies,
  );
  assert.equal(reset.status, 202);
  await resetScheduled.drain();
  assert.equal(lookups, 31);
});

test("five wrong codes are counted without Discord calls and clear the nonce on final failure", async (t) => {
  const { client, env } = await fixture(t);
  const discord = fullDiscordMock();
  const scheduled = scheduledStart({ nowSeconds: NOW, fetcher: discord.fetcher });
  const start = await handleDiscordDmStart(
    mutationRequest("/api/auth/discord/dm/start", { identity: DISCORD_ID }),
    env,
    scheduled.dependencies,
  );
  await scheduled.drain();
  const { challengeId } = await start.json();
  const nonce = cookieValue(start, DM_CHALLENGE_COOKIE);
  const wrongCode = discord.deliveredCode === "0000000000" ? "1111111111" : "0000000000";
  const callsBeforeVerify = discord.calls.length;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await handleDiscordDmVerify(
      mutationRequest("/api/auth/discord/dm/verify", { challengeId, code: wrongCode }, {
        cookie: `${DM_CHALLENGE_COOKIE}=${nonce}`,
      }),
      env,
      { nowSeconds: NOW + attempt, fetcher: discord.fetcher },
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "DM_AUTH_FAILED");
    if (attempt < 5) {
      assert.equal(response.headers.get("set-cookie"), null);
    } else {
      assert.match(response.headers.get("set-cookie"), new RegExp(`${DM_CHALLENGE_COOKIE}=;`));
    }
  }
  assert.equal(discord.calls.length, callsBeforeVerify);
  const challenge = client.sqlite.prepare(`
    SELECT attempts, consumed_at FROM discord_dm_challenges
  `).get();
  assert.equal(challenge.attempts, 5);
  assert.notEqual(challenge.consumed_at, null);
  assert.equal(client.sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get().count, 0);
});

test("a correct code still fails terminally when fresh guild membership cannot be proven", async (t) => {
  const { client, env } = await fixture(t);
  const discord = fullDiscordMock();
  const scheduled = scheduledStart({ nowSeconds: NOW, fetcher: discord.fetcher });
  const start = await handleDiscordDmStart(
    mutationRequest("/api/auth/discord/dm/start", { identity: "caseuser" }),
    env,
    scheduled.dependencies,
  );
  await scheduled.drain();
  const body = await start.json();
  const nonce = cookieValue(start, DM_CHALLENGE_COOKIE);
  const failed = await handleDiscordDmVerify(
    mutationRequest("/api/auth/discord/dm/verify", {
      challengeId: body.challengeId,
      code: discord.deliveredCode,
    }, { cookie: `${DM_CHALLENGE_COOKIE}=${nonce}` }),
    env,
    {
      nowSeconds: NOW + 1,
      fetcher: async () => Response.json({ code: 10007, message: "Unknown Member" }, { status: 404 }),
    },
  );
  assert.equal(failed.status, 400);
  assert.equal((await failed.json()).code, "DM_AUTH_FAILED");
  assert.match(failed.headers.get("set-cookie"), new RegExp(`${DM_CHALLENGE_COOKIE}=;`));
  assert.equal(client.sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get().count, 0);
  assert.notEqual(
    client.sqlite.prepare("SELECT consumed_at FROM discord_dm_challenges").get().consumed_at,
    null,
  );
});
