# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `25`  
Updated: `2026-07-28T16:09:59+08:00`  
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Deploy the rebuilt Home surface and its six approved visuals through Sites as an owner-only private release, so the owner can review it on a phone, while leaving public access, added viewers, custom domain and search indexing unauthorized.

## Last checkpoint

- ID: `CP-000025`
- Summary: Recorded owner approval of the six Home visuals and fixed the mobile layout, clearing the way for an owner-only deployment of the rebuilt Home surface. RIGHTS-AND-IMAGE2-APPROVAL-20260728-001 records the approver, the visual check at desktop and 390px widths, the four GODS in the key visual, the GOD and OTOMO pair plus form for each of the five cards, and the SPIRIT 1 / INCARNATE 2 / DOJI 2 form distribution; all six manifest rows moved from PENDING_APPROVAL to APPROVED and no PENDING_APPROVAL row remains. Mobile verification at 390px found four real defects, all fixed: the new dock duplicated the existing mobile tab bar, the hero occupied roughly sixty percent of the screen, the title broke mid-word between 競 and う, and the key visual cropped its characters away. A LAN exposure attempt for phone testing was reverted because vinext ignores both the --host flag and server.host, leaving the configuration exactly as before. BLK-KEY-VISUAL-APPROVAL-001 is closed. Lint, typecheck, production build and 76 tests pass. Deployment itself remains an owner action: this repository has no git remote and Sites is the only production pipeline.

## Blockers

- `BLK-CONCURRENT-GAME-SESSION-001` [OPEN]: A separate owner-run session implements Discord login inside the OTOMO CHAIN 7 repository; its server side is committed and deployed with the feature disabled while its web side was still uncommitted. Writing there from this session would destroy concurrent work, and that session's git housekeeping has already deleted an untracked directory created here, so generated assets are produced outside the repository until they are committed. — Owner: SGG project owner — Unblock: Confirm the OTOMO CHAIN work is committed and its export shape final before this session adapts dashboard reconciliation or edits that repository.
- `BLK-OTOMO-CHAIN-EXPORT-001` [OPEN]: OTOMO CHAIN 7 exposes external_id only through its admin-secret reward-export endpoint. The reconciliation and payout code is deployed but remains disabled until OTOMO_CHAIN_EXPORT_URL and OTOMO_CHAIN_ADMIN_SECRET are configured after season end. — Owner: SGG project owner — Unblock: After the season ends, provide the OTOMO CHAIN 7 reward-export endpoint and admin secret as Sites runtime secrets, then start with a reconciliation dry run.
- `BLK-SGP-AWARD-TABLE-001` [OPEN]: SGP amounts per final rank are an official reward decision and are not recorded. The deployed payout endpoint requires an operator-supplied award table and rejects any request without one. — Owner: SGG project owner — Unblock: Decide and record the season-0 SGP award table, then pass it explicitly to the payout dry run before any apply=true request.
- `BLK-DISCORD-E2E-001` [OPEN]: Automated tests and production smoke cover the DM protocol and fail-closed guards, but no real user DM was sent and a two-account isolation test requires interactive access to two consenting Discord identities. — Owner: SGG project owner — Unblock: Run one real ordinary-player DM login and confirm two distinct Discord accounts cannot read each other's Passport, ledger, or holdings before expanding access beyond the current owner-only site.
- `BLK-PUBLICATION-001` [OPEN]: Version 12 is deployed owner-only, and public or shared access, custom domain attachment, search indexing, extra viewers or groups, and public release remain unauthorized. — Owner: SGG project owner — Unblock: Record separate explicit owner authority and satisfy the release identity, privacy, domain, rollback, real-account isolation, dependency, and actual-screen gates before any audience expansion.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so in-game progress and resources remain intentionally unconnected. On-chain wallet holdings are separate and do not depend on this bridge. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting in-game data.
- `BLK-DEPENDENCY-SHARP-001` [OPEN]: Stable Next and Miniflare still require Sharp 0.34.5, which npm audit flags for inherited libvips advisories. The built Worker has no Sharp or libvips import and the application has no untrusted image-processing path, so the documented owner-only non-reachable exception remains in force. — Owner: SGG engineering owner — Unblock: Upgrade when stable Next and Cloudflare or Miniflare officially support patched Sharp; reassess immediately if image upload or server-side untrusted processing is added.

## Next actions

1. `ACT-025` [READY] Deploy the approved Home rebuild through Sites as an owner-only private release, changing no access setting. — Owner: SGG project owner
2. `ACT-026` [READY] Open the deployed site on a phone and confirm the rebuilt Home renders as reviewed locally. — Owner: SGG project owner
3. `ACT-022` [READY] Add the OTOMO CHAIN redirect URI to the approved MY SGG Discord application and set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in the OTOMO CHAIN Vercel project so discord_enabled becomes true. — Owner: SGG project owner
4. `ACT-024` [READY] Review the two drifted command-center policy files (OTOMO_FORM_BALANCE_V1.md and canon/TERMINOLOGY.md, both changed 2026-07-26 19:33) and refresh their recorded hashes deliberately; validation fails until then. — Owner: SGG project owner
5. `ACT-015` [BLOCKED] Complete the two-account isolation check with two consenting Discord identities before adding any viewer; docs/CORE_MEMBER_RELEASE_CHECKLIST.md has the procedure and tests/two-account-isolation.test.mjs covers the implementation. — Owner: SGG project owner
6. `ACT-021` [BLOCKED] Adapt dashboard reconciliation to the game's verified Discord ID after the concurrent OTOMO CHAIN work is committed. — Owner: SGG project owner
7. `ACT-018` [BLOCKED] After the season ends on 2026-08-08T00:00:00Z, configure the OTOMO CHAIN export secrets, run the reconcile dry run, resolve anything ambiguous by hand, then run the payout dry run with a decided award table before applying. — Owner: SGG project owner
8. `ACT-012` [BLOCKED] Upgrade to stable Next and Cloudflare or Miniflare versions that officially support patched Sharp. — Owner: SGG engineering owner
9. `ACT-006` [BLOCKED] Implement side-effect-free, audience-bound, replay-protected player snapshot bridges per game before showing in-game progress. — Owner: SGG game platform owner
10. `ACT-008` [BLOCKED] Request and record separate authority before public or shared access, a custom domain, search indexing, or added viewers and groups. — Owner: SGG project owner

## Resume exactly here

`ACT-025` — Deploy the current source through the Sites source and version workflow as an owner-only private release, changing no access setting, then open the deployed URL on a phone and confirm the rebuilt Home. Validation still fails on two drifted command-center policy hashes, which the owner must review rather than have refreshed silently.
