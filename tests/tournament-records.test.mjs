import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { games, tournamentRecords } from "../app/dashboard-data.ts";

// SGGでの軌跡 is a ledger of finished tournaments. Its promise is the same as
// the rest of the dashboard: nothing fabricated, nothing provisional. These
// tests keep every record internally consistent so a hand-edited entry cannot
// ship half-filled, and keep the UI machinery (search, filter, paging) wired.

test("every tournament record is a complete, internally consistent result", () => {
  assert.ok(tournamentRecords.length >= 1, "the first tournament is on record");
  const ids = new Set();
  for (const record of tournamentRecords) {
    assert.ok(!ids.has(record.id), `duplicate record id ${record.id}`);
    ids.add(record.id);

    // The game must exist in the catalogue under the exact same title.
    const game = games.find((entry) => entry.id === record.gameId);
    assert.ok(game, `${record.id}: unknown gameId ${record.gameId}`);
    assert.equal(record.game, game.title, `${record.id}: game title drifted from the catalogue`);

    // A finished tournament has a real, ordered period.
    const start = new Date(record.startAt).getTime();
    const end = new Date(record.endAt).getTime();
    assert.ok(Number.isFinite(start) && Number.isFinite(end), `${record.id}: unparsable period`);
    assert.ok(end > start, `${record.id}: endAt must follow startAt`);

    // The podium counts from 1 with non-increasing scores, and never claims
    // more finishers than participants.
    assert.ok(record.podium.length >= 1, `${record.id}: empty podium`);
    assert.ok(record.participants >= record.podium.length, `${record.id}: podium exceeds participants`);
    record.podium.forEach((entry, index) => {
      assert.equal(entry.rank, index + 1, `${record.id}: podium ranks must be 1..n`);
      assert.ok(entry.name.trim(), `${record.id}: rank ${entry.rank} has no name`);
      assert.ok(Number.isInteger(entry.score) && entry.score > 0, `${record.id}: rank ${entry.rank} score`);
      if (index > 0) {
        assert.ok(entry.score <= record.podium[index - 1].score, `${record.id}: podium scores out of order`);
      }
    });

    // Recurring tournaments are found again by their edition label.
    assert.ok(record.edition.trim(), `${record.id}: missing edition label`);
    assert.ok(record.name.includes(record.edition), `${record.id}: name should carry the edition`);
    assert.ok(record.provenance.trim(), `${record.id}: a record must state its source`);
    if (record.prizeSgpTotal !== null) {
      assert.ok(Number.isInteger(record.prizeSgpTotal) && record.prizeSgpTotal > 0, `${record.id}: prize total`);
    }
  }
});

test("the first OTOMO CHAIN 7 tournament is recorded as it actually ended", () => {
  const record = tournamentRecords.find((entry) => entry.id === "chain-7-tournament-1");
  assert.ok(record, "the 8/1 tournament record exists");
  // Locked leaderboard facts (leaderboard/season, 2026-08-08 lock).
  assert.equal(record.participants, 52);
  assert.equal(record.podium[0].name, "しるばー");
  assert.equal(record.podium[0].score, 911_367);
  assert.equal(record.teamChampion, "大耀陣営");
  // Award table decided for the season (distributions/otomo-chain-7-season-2026-08-01).
  assert.equal(record.prizeSgpTotal, 1_129);
  assert.equal(record.seasonId, "season-2026-08-01");
});

test("the 軌跡 view searches, filters by game, and pages five at a time", async () => {
  const dashboard = await readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8");

  assert.match(dashboard, /TRAJECTORY_PAGE_SIZE = 5/);
  assert.match(dashboard, /trajectoryRecords\.filter/);
  assert.match(dashboard, /record\.gameId !== trajectoryGame/);
  assert.match(dashboard, /大会名・プレイヤー名で検索/);
  assert.match(dashboard, /ゲーム別フィルター/);
  // Newest tournament first, regardless of data-file order.
  assert.match(dashboard, /b\.endAt\.localeCompare\(a\.endAt\)/);
  // Search or filter changes always rewind to page one.
  assert.match(dashboard, /setTrajectoryQuery\(event\.target\.value\); setTrajectoryPage\(1\);/);
  // The empty state names the filters, not a fictional lack of tournaments.
  assert.match(dashboard, /条件に合う大会記録はありません/);
  // Every card states where its numbers come from.
  assert.match(dashboard, /record\.provenance/);
});

test("each card carries the viewer's own result, honestly staged", async () => {
  const dashboard = await readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8");

  // The personal band exists and comes from the passport, keyed by record id.
  assert.match(dashboard, /myTournamentResults\.get\(record\.id\)/);
  assert.match(dashboard, /YOUR RESULT \/ あなたの成績/);
  // SGP state mirrors the ledger: 付与済み only when the grant exists.
  assert.match(dashboard, /myResult\.granted \? "付与済み" : "付与予定"/);
  // Signed in without a row says "no participation", never a zero result.
  assert.match(dashboard, /この大会でのあなたの参加記録はありません/);
  // Signed out, the section explains what logging in unlocks.
  assert.match(dashboard, /あなたの順位・得点・獲得SGPがカードに表示されます/);
});
