import assert from "node:assert/strict";
import test from "node:test";

import { SqliteD1Database, applyProjectMigrations } from "./helpers/sqlite-d1.mjs";

await import("tsx/esm");

const { deriveLinkCode, findLinkCodeIn, ensureGameLink, OTOMO_CHAIN_GAME_ID } =
  await import("../server/game-link.ts");
const { getDbFromEnv } = await import("../server/passport-db.ts");

const SECRET = "0123456789abcdef0123456789abcdef";

test("derives a stable, player-specific code", async () => {
  const first = await deriveLinkCode(SECRET, OTOMO_CHAIN_GAME_ID, "815074636873072661");
  const again = await deriveLinkCode(SECRET, OTOMO_CHAIN_GAME_ID, "815074636873072661");
  const other = await deriveLinkCode(SECRET, OTOMO_CHAIN_GAME_ID, "815074636873072662");

  assert.equal(first, again, "reissuing must return the same code");
  assert.notEqual(first, other, "different players must not collide");
  assert.match(first, /^SGG-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  // I, L, O and U are excluded so a hand-copied code cannot be misread.
  assert.doesNotMatch(first, /[ILOU]/);
});

test("separates codes by game so one game's code cannot claim another", async () => {
  const chain = await deriveLinkCode(SECRET, OTOMO_CHAIN_GAME_ID, "815074636873072661");
  const elsewhere = await deriveLinkCode(SECRET, "otomo-quest-77", "815074636873072661");
  assert.notEqual(chain, elsewhere);
});

test("finds the code inside whatever the player actually typed", async () => {
  const code = await deriveLinkCode(SECRET, OTOMO_CHAIN_GAME_ID, "815074636873072661");
  const body = code.replace("SGG-", "").replace("-", "");

  assert.equal(findLinkCodeIn(code), code, "exact value");
  assert.equal(findLinkCodeIn(`  ${code}  `), code, "surrounding whitespace");
  assert.equal(findLinkCodeIn(code.toLowerCase()), code, "lowercase");
  assert.equal(findLinkCodeIn(`zm6509 / ${code}`), code, "with a handle alongside");
  assert.equal(findLinkCodeIn(`SGG${body}`), code, "separators stripped");
});

test("reports no code rather than guessing", async () => {
  assert.equal(findLinkCodeIn(null), null);
  assert.equal(findLinkCodeIn(undefined), null);
  assert.equal(findLinkCodeIn(""), null);
  assert.equal(findLinkCodeIn("zm6509"), null);
  assert.equal(findLinkCodeIn("@discord_handle"), null);
  assert.equal(findLinkCodeIn("SGG-SHORT"), null, "a truncated code must not match");
});

test("issues idempotently and refuses two Passports on one game account", async () => {
  const database = new SqliteD1Database();
  await applyProjectMigrations(database.sqlite);
  const db = getDbFromEnv({ DB: database });

  for (const discordId of ["815074636873072661", "815074636873072662"]) {
    await database
      .prepare("INSERT INTO players (discord_id, discord_username) VALUES (?, ?)")
      .bind(discordId, `player-${discordId}`)
      .run();
  }

  const issued = await ensureGameLink(db, {
    sessionSecret: SECRET,
    gameId: OTOMO_CHAIN_GAME_ID,
    discordId: "815074636873072661",
  });
  const reissued = await ensureGameLink(db, {
    sessionSecret: SECRET,
    gameId: OTOMO_CHAIN_GAME_ID,
    discordId: "815074636873072661",
  });

  assert.equal(issued.linkCode, reissued.linkCode);
  assert.equal(issued.issuedAt, reissued.issuedAt, "reissuing must not rewrite the row");
  assert.equal(issued.verifiedAt, null, "issuing a code must never assert verification");

  await ensureGameLink(db, {
    sessionSecret: SECRET,
    gameId: OTOMO_CHAIN_GAME_ID,
    discordId: "815074636873072662",
  });

  await database
    .prepare("UPDATE game_account_links SET game_player_id = ? WHERE discord_id = ?")
    .bind("plr_abc123", "815074636873072661")
    .run();

  await assert.rejects(
    database
      .prepare("UPDATE game_account_links SET game_player_id = ? WHERE discord_id = ?")
      .bind("plr_abc123", "815074636873072662")
      .run(),
    "one game account must not resolve to two Passports",
  );
});

const { planReconciliation } = await import("../server/game-link.ts");
const { parseExportPayload, otomoChainExportConfigFromEnv } =
  await import("../server/otomo-chain-export.ts");

const CODE_A = "SGG-W4RV-HH1K";
const CODE_B = "SGG-2T8N-QJ5D";

test("binds only codes that resolve to exactly one game account", () => {
  const plan = planReconciliation(
    [{ linkCode: CODE_A, discordId: "111111111" }, { linkCode: CODE_B, discordId: "222222222" }],
    [
      { gamePlayerId: "plr_a", externalId: `zm6509 ${CODE_A}` },
      { gamePlayerId: "plr_b", externalId: CODE_B.toLowerCase() },
      { gamePlayerId: "plr_c", externalId: "just-a-handle" },
    ],
  );

  assert.deepEqual(plan.matched.map((m) => m.discordId).sort(), ["111111111", "222222222"]);
  assert.equal(plan.unlinked, 1);
  assert.equal(plan.ambiguous.length, 0);
});

test("withholds a code claimed by two game accounts instead of picking one", () => {
  const plan = planReconciliation(
    [{ linkCode: CODE_A, discordId: "111111111" }],
    [
      { gamePlayerId: "plr_a", externalId: CODE_A },
      { gamePlayerId: "plr_thief", externalId: CODE_A },
    ],
  );

  assert.equal(plan.matched.length, 0, "an ambiguous code must never bind");
  assert.equal(plan.ambiguous.length, 1);
  assert.deepEqual(plan.ambiguous[0].gamePlayerIds.sort(), ["plr_a", "plr_thief"]);
});

test("does not invent a Passport for a code it never issued", () => {
  const plan = planReconciliation(
    [{ linkCode: CODE_A, discordId: "111111111" }],
    [{ gamePlayerId: "plr_x", externalId: CODE_B }],
  );

  assert.equal(plan.matched.length, 0);
  assert.deepEqual(plan.unknownCodes, [{ linkCode: CODE_B, gamePlayerId: "plr_x" }]);
});

test("rejects a partially malformed export rather than paying out part of it", () => {
  const good = { player_id: "plr_a", display_name: "A", external_id: null, final_rank: 1, season_score: 10 };
  assert.equal(parseExportPayload({ season_id: "s", records: [good] })?.records.length, 1);
  assert.equal(parseExportPayload({ season_id: "s", records: [good, { player_id: 7 }] }), null);
  assert.equal(parseExportPayload({ records: [] }), null, "a season id is required");
  assert.equal(parseExportPayload(null), null);
});

test("refuses export config that would leak the admin secret or is unset", () => {
  const secret = "chain-admin-secret-value";
  assert.equal(otomoChainExportConfigFromEnv({}), null);
  assert.equal(
    otomoChainExportConfigFromEnv({ OTOMO_CHAIN_EXPORT_URL: "https://x.test/api/reward-export" }),
    null,
    "a URL without a secret must not configure the client",
  );
  assert.equal(
    otomoChainExportConfigFromEnv({
      OTOMO_CHAIN_EXPORT_URL: "http://x.test/api/reward-export",
      OTOMO_CHAIN_ADMIN_SECRET: secret,
    }),
    null,
    "plaintext HTTP must be refused",
  );
  assert.ok(
    otomoChainExportConfigFromEnv({
      OTOMO_CHAIN_EXPORT_URL: "https://x.test/api/reward-export",
      OTOMO_CHAIN_ADMIN_SECRET: secret,
    }),
  );
});

const { parseAwardTable } = await import("../app/api/admin/tournament/payout/route.ts");

test("never defaults an SGP award table", () => {
  // Award amounts are an official reward decision; inventing one is forbidden.
  assert.equal(parseAwardTable(undefined), null);
  assert.equal(parseAwardTable(null), null);
  assert.equal(parseAwardTable([]), null);
  assert.equal(parseAwardTable("1"), null);
});

test("rejects award tables that are ambiguous or out of range", () => {
  assert.equal(parseAwardTable([{ maxRank: 1, amount: 0 }]), null, "zero award");
  assert.equal(parseAwardTable([{ maxRank: 1, amount: -5 }]), null, "negative award");
  assert.equal(parseAwardTable([{ maxRank: 0, amount: 5 }]), null, "rank below 1");
  assert.equal(parseAwardTable([{ maxRank: 1.5, amount: 5 }]), null, "fractional rank");
  assert.equal(
    parseAwardTable([{ maxRank: 3, amount: 5 }, { maxRank: 3, amount: 9 }]),
    null,
    "two tiers for one rank would make payout depend on ordering",
  );
});

test("normalises a valid award table into rank order", () => {
  assert.deepEqual(
    parseAwardTable([{ maxRank: 7, amount: 1 }, { maxRank: 1, amount: 3 }]),
    [{ maxRank: 1, amount: 3 }, { maxRank: 7, amount: 1 }],
  );
});

const { formatBalance, balanceOfCallData, SGG_CONTRACTS } =
  await import("../server/onchain-holdings.ts");

test("formats balances without ever overstating a holding", () => {
  assert.equal(formatBalance(BigInt(0), 0), "0");
  assert.equal(formatBalance(BigInt(7), 0), "7", "NFT counts are whole units");
  assert.equal(formatBalance(BigInt(10) ** BigInt(18), 18), "1");
  assert.equal(formatBalance(BigInt("1500000000000000000"), 18), "1.5");
  // Truncates rather than rounds up, so the display never claims more.
  assert.equal(formatBalance(BigInt("1999999999999999999"), 18), "1.9999");
  assert.equal(formatBalance(BigInt(1), 18), "0", "dust must not become 1");
});

test("encodes balanceOf for the wallet and nothing else", () => {
  const data = balanceOfCallData("0x24fA00000000000000000000000000000000eC64");
  assert.equal(data.length, 10 + 64);
  assert.ok(data.startsWith("0x70a08231"));
  assert.ok(data.endsWith("24fa00000000000000000000000000000000ec64"));
});

test("pins the verified SGG contract set", () => {
  // Confirmed on Ethereum mainnet by reading name/symbol/totalSupply.
  assert.equal(SGG_CONTRACTS.length, 5);
  assert.deepEqual(
    SGG_CONTRACTS.map((c) => c.id),
    ["gods", "otomo-seireitai", "otomo-junikutai", "otomo-douji", "sdt"],
  );
  assert.equal(SGG_CONTRACTS.filter((c) => c.kind === "TOKEN").length, 1);
  for (const contract of SGG_CONTRACTS) {
    assert.match(contract.address, /^0x[0-9a-fA-F]{40}$/);
    assert.equal(contract.kind === "NFT" ? contract.decimals : 18, contract.decimals);
  }
});

const { resolveIdentities } = await import("../server/game-link.ts");
const { parsePreEntryPayload } = await import("../server/otomo-chain-export.ts");

test("identity resolution prefers the strongest source per account", () => {
  const resolved = resolveIdentities({
    records: [
      { gamePlayerId: "plr_a", recordDiscordId: "900000000000000001", externalId: `also has ${CODE_A}` },
      { gamePlayerId: "plr_b", recordDiscordId: null, externalId: null },
      { gamePlayerId: "plr_c", recordDiscordId: null, externalId: CODE_A },
      { gamePlayerId: "plr_d", recordDiscordId: null, externalId: null },
    ],
    preEntries: [
      { gamePlayerId: "plr_b", discordId: "900000000000000002" },
      { gamePlayerId: "plr_d", discordId: null },
    ],
    issuedLinks: [
      { linkCode: CODE_A, discordId: "111111111", gamePlayerId: null },
    ],
  });

  assert.equal(resolved.get("plr_a")?.source, "RECORD_DISCORD");
  assert.equal(resolved.get("plr_a")?.discordId, "900000000000000001");
  assert.equal(resolved.get("plr_b")?.source, "PRE_ENTRY");
  assert.equal(resolved.get("plr_c")?.source, "LINK_CODE");
  assert.equal(resolved.get("plr_c")?.discordId, "111111111");
  assert.equal(resolved.get("plr_d"), undefined, "no source resolves nothing");
});

test("pre-entry payload parses verified ids and drops malformed ones", () => {
  const parsed = parsePreEntryPayload({
    season_id: "s",
    records: [
      { player_id: "plr_a", discord_id: "900000000000000001", discord_username: "alice", pre_entered_at: "2026-07-30T00:00:00Z" },
      { player_id: "plr_b", discord_id: "not-a-snowflake", discord_username: null, pre_entered_at: "2026-07-30T00:00:00Z" },
    ],
  });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].discordId, "900000000000000001");
  assert.equal(parsed[1].discordId, null, "malformed id treated as absent, not trusted");
  assert.equal(parsePreEntryPayload({ records: [] }), null, "season id required");
  assert.equal(parsePreEntryPayload({ season_id: "s", records: [{ player_id: "" }] }), null);
});
