# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `45`  
Updated: `2026-07-30T21:18:52+08:00`  
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Deploy the verified connection layer and the complete NFT gallery (all four collections including SEVEN GODS) through Sites, then have the owner flip the two external switches: CHAIN's Discord credentials in Vercel, and the export/pre-entry secrets in Sites after the season.

## Last checkpoint

- ID: `CP-000045`
- Summary: アリーナ emptied to an honest 準備中 placeholder on the owner's direction (four mobile screenshots of the arena, then 「削除」; the owner chose to keep the tab and delete the contents). Removed: the 神託番付 and シーズン序列 live boards, the 公開ランキング competition-card grid, the PUBLISHED EVENTS empty state, and the FAIR PLAY note whose copy was untranslated pipeline jargon (raw gameplay → ranking → SGG_GAME_POINTS → reward candidate). What replaces them states plainly what the screen will hold and that nothing ships until it can be shown. The removal was followed through the rest of the surface rather than left half-done: the home 開催中の大会 card no longer prints a competition count that nothing backs and now reads 準備中/アリーナを見る; the desktop dock's 神託 button, a shortcut to the deleted oracle board that merely duplicated アリーナ, is gone; the home quick menu's 番付 became 闘技 to match its destination. Dead code went with it — CompetitionCard, Leaderboard, the competitions/Competition/LiveRanking/IconOracle imports, oracleSourceState/questSourceState, loadLiveData and the syncing flag — leaving lint clean; syncLiveData and its effects are untouched, so the home banner and play-view runtime health still load. A layout defect the near-empty screen exposed was fixed at the root: .shell is now a flex column with .content growing, so a short view pushes the footer to the bottom instead of stranding it mid-screen above ~300px of dead space. The two honesty guards in rendered-html.test.mjs were re-pointed at the new copy rather than weakened. Verified at 375x812 and on desktop: arena, home, play, collection, community, マイSGG all lay out with no horizontal overflow. 91 tests, lint, typecheck, production build pass.

## Blockers

- `BLK-IN-APP-BROWSER-001` [OPEN]: This Codex task exposes the Browser skill but not its required in-app browser control capability after mandatory discovery. The existing protected production tab remains untouched. Version 14 has Sites screenshot, production HTTP, asset-hash, HTML/CSS and Worker-log evidence, but no new muted tab, interactive 390px viewport or console session was available. — Owner: Codex runtime capability — Unblock: Expose the supported Codex in-app browser control capability, then open the exact Version 14 URL in a new muted tab without navigating or closing the protected tab and complete desktop, 390px, interaction and console verification.
- `BLK-CONCURRENT-GAME-SESSION-001` [OPEN]: A separate owner-run session implements Discord login inside the OTOMO CHAIN 7 repository; its server side is committed and deployed with the feature disabled while its web side was still uncommitted. Writing there from this session would destroy concurrent work, and that session's git housekeeping has already deleted an untracked directory created here, so generated assets are produced outside the repository until they are committed. — Owner: SGG project owner — Unblock: Confirm the OTOMO CHAIN work is committed and its export shape final before this session adapts dashboard reconciliation or edits that repository.
- `BLK-OTOMO-CHAIN-EXPORT-001` [OPEN]: OTOMO CHAIN 7 exposes external_id only through its admin-secret reward-export endpoint. The reconciliation and payout code is deployed but remains disabled until OTOMO_CHAIN_EXPORT_URL and OTOMO_CHAIN_ADMIN_SECRET are configured after season end. — Owner: SGG project owner — Unblock: After the season ends, provide the OTOMO CHAIN 7 reward-export endpoint and admin secret as Sites runtime secrets, then start with a reconciliation dry run.
- `BLK-SGP-AWARD-TABLE-001` [OPEN]: SGP amounts per final rank are an official reward decision and are not recorded. The deployed payout endpoint requires an operator-supplied award table and rejects any request without one. — Owner: SGG project owner — Unblock: Decide and record the season-0 SGP award table, then pass it explicitly to the payout dry run before any apply=true request.
- `BLK-DISCORD-E2E-001` [OPEN]: Automated tests and production smoke cover the DM protocol and fail-closed guards, but no real user DM was sent and a two-account isolation test requires interactive access to two consenting Discord identities. — Owner: SGG project owner — Unblock: Run one real ordinary-player DM login and confirm two distinct Discord accounts cannot read each other's Passport, ledger or holdings before expanding access beyond the current owner-only site.
- `BLK-PUBLICATION-001` [OPEN]: Version 14 is deployed owner-only, and public or shared access, custom domain attachment, search indexing, extra viewers or groups and public release remain unauthorized. — Owner: SGG project owner — Unblock: Record separate explicit owner authority and satisfy the release identity, privacy, domain, rollback, real-account isolation, dependency and actual-screen gates before any audience expansion.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so in-game progress and resources remain intentionally unconnected. On-chain wallet holdings are separate and do not depend on this bridge. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting in-game data.
- `BLK-DEPENDENCY-SHARP-001` [OPEN]: Stable Next and Miniflare still require Sharp 0.34.5, which npm audit flags for inherited libvips advisories. The built Worker has no Sharp or libvips import and the application has no untrusted image-processing path, so the documented owner-only non-reachable exception remains in force. — Owner: SGG engineering owner — Unblock: Upgrade when stable Next and Cloudflare or Miniflare officially support patched Sharp; reassess immediately if image upload or server-side untrusted processing is added.

## Next actions

1. `ACT-039` [READY] Owner redeploys through Sites (the NFT gallery, widened image CSP and connection layer ride it). — Owner: SGG project owner
2. `ACT-022` [READY] Add the OTOMO CHAIN redirect URI to the MY SGG Discord app and set DISCORD_CLIENT_ID/SECRET in Vercel so discord_enabled becomes true. — Owner: SGG project owner
3. `ACT-018` [BLOCKED] After the season: set OTOMO_CHAIN_EXPORT_URL, OTOMO_CHAIN_PREENTRY_URL and OTOMO_CHAIN_ADMIN_SECRET in Sites, then dry-run stones and reconcile and payout with a decided award table. — Owner: SGG project owner
4. `ACT-024` [READY] Review the two drifted command-center policy hashes. — Owner: SGG project owner
5. `ACT-015` [BLOCKED] Two-account isolation check before adding any viewer. — Owner: SGG project owner
6. `ACT-012` [BLOCKED] Sharp upgrade when supported. — Owner: SGG engineering owner
7. `ACT-006` [BLOCKED] Player snapshot bridges per game. — Owner: SGG game platform owner
8. `ACT-008` [BLOCKED] Separate authority before audience expansion. — Owner: SGG project owner

## Resume exactly here

`ACT-039` — Deployment through Sites remains the owner's step (migration 0006 must ride it). アリーナ stays 準備中 until real competition data exists; the deleted boards are recoverable from git history for the rebuild.
