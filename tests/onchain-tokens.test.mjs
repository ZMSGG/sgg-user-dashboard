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
