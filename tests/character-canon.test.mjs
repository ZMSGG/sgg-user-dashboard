import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { characterPairs } from "../app/dashboard-data.ts";
import { GACHA_CARDS } from "../server/gacha.ts";

// Character names are canon, not copy. Two of the seven shipped misspelled
// (彩華 for 才華, 福栄 for 福永) and reached production because nothing
// compared them against the command centre's characters.json. A tester caught
// it. This reads the canon file and asserts every displayed name matches.
const CANON_URL = new URL("../../SGG　司令塔/SGG createve/canon/characters.json", import.meta.url);

async function canonPairs() {
  const raw = JSON.parse(await readFile(CANON_URL, "utf8"));
  const found = new Map();
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    if (node.god?.id && node.god?.nameJa && node.otomo?.id && node.otomo?.nameJa) {
      found.set(node.god.id.toUpperCase(), {
        godName: node.god.nameJa,
        otomoId: node.otomo.id.toUpperCase(),
        otomoName: node.otomo.nameJa,
      });
    }
    Object.values(node).forEach(walk);
  };
  walk(raw);
  return found;
}

test("displayed GODS and OTOMO names match the canon character list", async (t) => {
  let canon;
  try {
    canon = await canonPairs();
  } catch {
    // The command centre lives outside this repo; CI without it should skip
    // rather than fail, but a local run must still catch a renamed character.
    t.skip("canon characters.json not reachable from this checkout");
    return;
  }
  assert.ok(canon.size >= 7, `canon parsed ${canon.size} pairs`);

  for (const pair of characterPairs) {
    const want = canon.get(pair.godId.toUpperCase());
    assert.ok(want, `${pair.godId} missing from canon`);
    assert.equal(pair.godName, want.godName, `${pair.godId} GODS name`);
    assert.equal(pair.otomoName, want.otomoName, `${pair.godId} OTOMO name`);
  }

  // The gacha deck repeats the names, so it can drift on its own.
  const byGod = new Map([...canon.values()].map((v) => [v.godName, v]));
  for (const card of GACHA_CARDS) {
    const want = byGod.get(card.godName);
    assert.ok(want, `gacha card "${card.godName}" is not a canon GODS name`);
    assert.equal(card.otomoName, want.otomoName, `${card.godName} OTOMO name`);
  }
});
