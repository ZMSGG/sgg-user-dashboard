import assert from "node:assert/strict";
import test from "node:test";

import { decodeTokenIds, deriveMetadataTemplate } from "../server/onchain-holdings.ts";

const word = (n) => n.toString(16).padStart(64, "0");
const encode = (ids) => `0x${word(32)}${word(ids.length)}${ids.map(word).join("")}`;

test("decodeTokenIds reads a uint256[] response", () => {
  assert.deepEqual(decodeTokenIds(encode([65, 68])), [65, 68]);
  assert.deepEqual(decodeTokenIds(encode([])), []);
});

test("decodeTokenIds rejects malformed or oversized responses", () => {
  assert.equal(decodeTokenIds("0x"), null);
  assert.equal(decodeTokenIds("not-hex-at-all-but-long".padEnd(140, "x")), null);
  // A declared count far beyond the cap must not allocate.
  assert.equal(decodeTokenIds(`0x${word(32)}${word(9999)}`), null);
  // Truncated payload: count says two, only one word present.
  assert.equal(decodeTokenIds(`0x${word(32)}${word(2)}${word(65)}`), null);
});

test("deriveMetadataTemplate only trusts the allowlisted host", () => {
  const ok = deriveMetadataTemplate(
    "https://storage.googleapis.com/shichifuku/douji/metadata/65.json",
    65,
  );
  assert.equal(typeof ok, "function");
  assert.equal(ok(68), "https://storage.googleapis.com/shichifuku/douji/metadata/68.json");

  assert.equal(deriveMetadataTemplate("https://evil.example/shichifuku/65.json", 65), null);
  assert.equal(deriveMetadataTemplate("ipfs://QmHash/65.json", 65), null);
  // Shape we cannot template from must fail closed rather than guess.
  assert.equal(deriveMetadataTemplate("https://storage.googleapis.com/x/65", 65), null);
});

import { decodeAggregate3, encodeAggregate3 } from "../server/onchain-holdings.ts";

const w = (n) => n.toString(16).padStart(64, "0");

test("aggregate3 encode/decode round-trip shape", () => {
  const target = "0x4cc90f512e0006595e9d11c7fe3ed4c92bc86fe1";
  const data = encodeAggregate3(target, [`6352211e${w(378)}`, `6352211e${w(384)}`]);
  assert.ok(data.startsWith("0x82ad56cb"));
  assert.ok(data.includes(target.slice(2)));

  // Hand-built aggregate3 response: two successful ownerOf returns.
  const owner = w(0x24fa54b3); // arbitrary padded address word
  const tuple = (bytes) => w(1) + w(64) + w(bytes.length / 2) + bytes;
  const t1 = tuple(owner);
  const t2 = tuple(owner);
  const body = w(64) + w(t1.length / 2 + 64);
  const result = "0x" + w(32) + w(2) + body + t1 + t2;
  const decoded = decodeAggregate3(result, 2);
  assert.equal(decoded.length, 2);
  assert.ok(decoded.every((d) => d.success && d.bytes === owner));
});

test("decodeAggregate3 rejects truncated responses", () => {
  assert.equal(decodeAggregate3("0x", 1), null);
  assert.equal(decodeAggregate3("0x" + w(32) + w(2) + w(64), 2), null);
});

import { deriveThumbUrl } from "../server/onchain-holdings.ts";

test("deriveThumbUrl maps images to the bucket's 250px variants", () => {
  assert.equal(
    deriveThumbUrl("https://storage.googleapis.com/shichifuku/douji/images/65.png"),
    "https://storage.googleapis.com/shichifuku/douji/thumbnails/65.png",
  );
  // GODS keeps images at the bucket root.
  assert.equal(
    deriveThumbUrl("https://storage.googleapis.com/shichifuku/images/378.png"),
    "https://storage.googleapis.com/shichifuku/thumbnails/378.png",
  );
  assert.equal(deriveThumbUrl("https://evil.example/images/1.png"), null);
  assert.equal(deriveThumbUrl("https://storage.googleapis.com/shichifuku/art/1.png"), null);
});

/* ---- balance reads: one batched request, retried once ------------------- */

import { readHoldings, SGG_CONTRACTS } from "../server/onchain-holdings.ts";

const okBody = (calls, value = 3) =>
  calls.map((_, id) => ({ jsonrpc: "2.0", id, result: `0x${value.toString(16).padStart(64, "0")}` }));

function stubFetch(handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    return handler(body, calls.length);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const json = (payload) => new Response(JSON.stringify(payload), {
  status: 200, headers: { "content-type": "application/json" },
});

test("every balance is read in a single batched request", async () => {
  const stub = stubFetch((body) => json(okBody(body)));
  try {
    const snapshot = await readHoldings("0x24fa54b3e99240c4c7b4b4a68f3f33f01eedec64");
    // One HTTP request total, carrying one eth_call per contract.
    assert.equal(stub.calls.length, 1);
    assert.equal(stub.calls[0].length, SGG_CONTRACTS.length);
    assert.ok(stub.calls[0].every((entry) => entry.method === "eth_call"));
    assert.ok(snapshot.holdings.every((h) => h.balance !== null));
  } finally {
    stub.restore();
  }
});

test("a dropped call is retried once, and only the dropped one", async () => {
  // First response omits the last entry, as a rate-limited node does.
  const stub = stubFetch((body, attempt) => attempt === 1
    ? json(okBody(body).slice(0, -1))
    : json(okBody(body)));
  try {
    const snapshot = await readHoldings("0x24fa54b3e99240c4c7b4b4a68f3f33f01eedec64");
    assert.equal(stub.calls.length, 2);
    // The retry carries only the one that failed, not the whole set again.
    assert.equal(stub.calls[1].length, 1);
    assert.ok(snapshot.holdings.every((h) => h.balance !== null), "retry recovered the missing balance");
  } finally {
    stub.restore();
  }
});

test("a read that never succeeds reports unknown, never zero", async () => {
  const stub = stubFetch(() => new Response("rate limited", { status: 429 }));
  try {
    const snapshot = await readHoldings("0x24fa54b3e99240c4c7b4b4a68f3f33f01eedec64");
    assert.equal(stub.calls.length, 2, "one retry, then it gives up");
    assert.ok(snapshot.holdings.every((h) => h.balance === null));
    assert.ok(snapshot.holdings.every((h) => h.balance !== "0"), "a failed read must not read as a real zero");
  } finally {
    stub.restore();
  }
});
