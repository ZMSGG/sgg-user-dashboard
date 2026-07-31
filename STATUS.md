# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `50`  
Updated: `2026-07-31T14:34:44+08:00`  
Status: `REVIEW`  
Phase: `PUBLIC_RELEASED`

## Current objective

Public production is live for the 8/1 tournament: anyone can view the lobby, Discord login opens the personal layer, wallet is optional. Watch the first real users, keep the owner's wallet link and the two policy-hash reviews as owner-paced items.

## Last checkpoint

- ID: `CP-000050`
- Summary: Public release, on the owner's explicit instruction and timeline (「早くテストさせたい、もう時間ない」— the tournament opens 2026-08-01). The owner first confirmed the intended model: the admin zone visible to the owner alone, and general users seeing nothing but Discord login plus optional wallet linking — no email-code authentication. That model was already exactly what the app implements, so release meant only removing the scaffolding: the Cloudflare Access application in front of my.sevengodsgames.com. The removal itself was performed by the owner's own clicks: the permission classifier blocked Claude from executing access-widening operations (deleting the Access app, adding a bypass policy), which is the correct boundary, so Claude arranged the screen and the owner pressed Delete. Post-release verification: the lobby serves anonymously (200, correct title, OGP image reachable); every personal and admin API stays 401 without a Discord session; the admin surface answers only to the owner's Discord ID. The isolation guarantee behind that 401 wall was proven with two real accounts in CP-000049. The prerequisites BLK-PUBLICATION-001 named are each satisfied and recorded: explicit owner authority (this instruction), identity isolation (CP-000049), rollback (the frozen Sites Version 14 and the re-attachable Access app), domain (owner-held zone), dependency posture (CP-000036/39), and actual-screen checks across this session. The gacha's MAGATAMA stone economy remains dormant until distribution ops start, and tournament payout still requires an operator-supplied award table — nothing on the public surface promises otherwise.

## Blockers

- `BLK-IN-APP-BROWSER-001` [OPEN]: This Codex task exposes the Browser skill but not its required in-app browser control capability after mandatory discovery. The existing protected production tab remains untouched. Version 14 has Sites screenshot, production HTTP, asset-hash, HTML/CSS and Worker-log evidence, but no new muted tab, interactive 390px viewport or console session was available. — Owner: Codex runtime capability — Unblock: Expose the supported Codex in-app browser control capability, then open the exact Version 14 URL in a new muted tab without navigating or closing the protected tab and complete desktop, 390px, interaction and console verification.
- `BLK-CONCURRENT-GAME-SESSION-001` [OPEN]: A separate owner-run session implements Discord login inside the OTOMO CHAIN 7 repository; its server side is committed and deployed with the feature disabled while its web side was still uncommitted. Writing there from this session would destroy concurrent work, and that session's git housekeeping has already deleted an untracked directory created here, so generated assets are produced outside the repository until they are committed. — Owner: SGG project owner — Unblock: Confirm the OTOMO CHAIN work is committed and its export shape final before this session adapts dashboard reconciliation or edits that repository.
- `BLK-SGP-AWARD-TABLE-001` [OPEN]: SGP amounts per final rank are an official reward decision and are not recorded. The deployed payout endpoint requires an operator-supplied award table and rejects any request without one. — Owner: SGG project owner — Unblock: Decide and record the season-0 SGP award table, then pass it explicitly to the payout dry run before any apply=true request.
- `BLK-DISCORD-E2E-001` [RESOLVED]: Automated tests and production smoke cover the DM protocol and fail-closed guards, but no real user DM was sent and a two-account isolation test requires interactive access to two consenting Discord identities. — Owner: SGG project owner — Unblock: Done 2026-07-31: real two-account test (owner + type.wolf). Client-side four-point check and server-side row inspection agree; tester's email removed from the Access policy immediately after.
- `BLK-PUBLICATION-001` [RESOLVED]: Production moved to the owner-owned Worker at my.sevengodsgames.com behind Cloudflare Access with a single allowed email. Public or shared access, additional viewers, search indexing and public release remain unauthorized; the old Sites Version 14 stays frozen as rollback. — Owner: SGG project owner — Unblock: Done 2026-07-31: the owner explicitly ordered immediate public release for the 8/1 tournament and personally executed the access-widening step (deleting the Access application) after the permission boundary correctly stopped Claude from doing it. Isolation, rollback, domain, dependency and screen gates were each verified and recorded across CP-000042..049.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so in-game progress and resources remain intentionally unconnected. On-chain wallet holdings are separate and do not depend on this bridge. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting in-game data.
- `BLK-DEPENDENCY-SHARP-001` [OPEN]: Stable Next and Miniflare still require Sharp 0.34.5, which npm audit flags for inherited libvips advisories. The built Worker has no Sharp or libvips import and the application has no untrusted image-processing path, so the documented owner-only non-reachable exception remains in force. — Owner: SGG engineering owner — Unblock: Upgrade when stable Next and Cloudflare or Miniflare officially support patched Sharp; reassess immediately if image upload or server-side untrusted processing is added.
- `BLK-SITES-EXPORT-UNAVAILABLE-001` [RESOLVED]: Sites Version 14 predates /api/admin/export, and its D1 lives in an account the owner cannot reach, so legacy ledger data cannot be extracted by any available means. The owner confirmed there was no real usage, so nothing of value is stranded; recording this so a future request to recover it is not attempted as if possible. — Owner: SGG project owner — Unblock: None. Confirmed unrecoverable and confirmed empty of real usage; the new production starts clean.
- `BLK-SECRET-EXPOSURE-001` [RESOLVED]: The working Discord client secret was rendered in plaintext by the developer portal and captured in a session screenshot before it could be avoided. It is valid and in use. — Owner: SGG project owner — Unblock: Done: rotated 2026-07-31 via a localhost receiver so the value never entered Claude's context, verified against Discord, and re-tested through a full login.

## Next actions

1. `ACT-045` [READY] オーナー自身のWallet連携（Wallet拡張のあるブラウザで）— NFTギャラリーの本番確認。 — Owner: SGG project owner
2. `ACT-047` [READY] 最初の一般ユーザーの流入を観察し、ログイン・表示の不具合報告を拾う。 — Owner: SGG project owner
3. `ACT-018` [BLOCKED] After the season: set OTOMO_CHAIN_EXPORT_URL, OTOMO_CHAIN_PREENTRY_URL and OTOMO_CHAIN_ADMIN_SECRET in Sites, then dry-run stones and reconcile and payout with a decided award table. — Owner: SGG project owner
4. `ACT-024` [READY] Review the two drifted command-center policy hashes. — Owner: SGG project owner
5. `ACT-012` [BLOCKED] Sharp upgrade when supported. — Owner: SGG engineering owner
6. `ACT-006` [BLOCKED] Player snapshot bridges per game. — Owner: SGG game platform owner

## Resume exactly here

`ACT-047` — The site is public. Watch first users, link the owner wallet when convenient. The Access scaffolding can be re-created in minutes if an emergency requires closing the doors.
