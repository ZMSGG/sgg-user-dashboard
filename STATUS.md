# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `37`  
Updated: `2026-07-29T17:29:40+08:00`  
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Preserve the owner-only Sites Version 14 release and complete interactive desktop, mobile and console verification when the supported Codex in-app browser control capability is available.

## Last checkpoint

- ID: `CP-000037`
- Summary: Committed the CP-000033-approved Zipangu lobby and gacha release as c675ac76bc6812c2a962dc034d3a2beaa9e3926d, pushed that exact commit to the existing Sites source main branch, saved Sites Version 14, and deployed it successfully as appgdep_6a69c62f72c4819182c1388847120b38 with environment revision 2. Migration 0005 is present in the saved version with its exact source hash and contains the currency column, gacha tables and database balance guard. All rejected swarm sprites were excluded from the release commit, clean build and archive; SWARM_ENABLED remains false and a production swarm probe returns 404. Sites access remained custom owner-only at policy revision 1 with one allowed user, zero groups, no public access and no custom domain; no access, owner, group, domain, environment or indexing control was changed. Production verification confirmed anonymous application-level GET /api/gacha and GET /api/passport return 401, the approved Zipangu backdrop and current transparent duty GOD match their source hashes, the Sites screenshot shows the full-bleed dusk lobby and duty GOD in the street, the production responsive bundle exposes one mobile navigation while hiding the duplicate dock, and no recent Worker errors were present. The mandatory in-app browser control capability is unavailable in this task, so a new muted tab, interactive responsive viewport and console verification remain explicitly unclaimed. The two known command-center policy hash drifts remain unresolved and were not refreshed.

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

1. `ACT-036` [BLOCKED] When supported Codex in-app browser control is available, open Version 14 in a new muted tab without touching the protected existing tab and complete interactive desktop, 390px and console verification. — Owner: Codex runtime capability
2. `ACT-033` [READY] Review the replacement mochi swarm separately; keep it disabled and outside production until explicitly approved. — Owner: SGG project owner
3. `ACT-022` [READY] Set the OTOMO CHAIN Discord credentials in Vercel. — Owner: SGG project owner
4. `ACT-024` [READY] Review the two drifted command-center policy hashes. — Owner: SGG project owner
5. `ACT-015` [BLOCKED] Two-account isolation check before adding any viewer. — Owner: SGG project owner
6. `ACT-021` [BLOCKED] Adapt reconciliation to verified Discord IDs when the game work lands. — Owner: SGG project owner
7. `ACT-018` [BLOCKED] Post-season export secrets, reconcile and pay out with a decided award table. — Owner: SGG project owner
8. `ACT-012` [BLOCKED] Upgrade Sharp when supported by stable framework dependencies. — Owner: SGG engineering owner
9. `ACT-006` [BLOCKED] Implement player snapshot bridges per game. — Owner: SGG game platform owner
10. `ACT-008` [BLOCKED] Request separate authority before any audience expansion. — Owner: SGG project owner

## Resume exactly here

`ACT-036` — Read CP-000037 and deployments/PRIVATE_DEPLOYMENT-20260729-001.json. Sites Version 14 from commit c675ac76bc6812c2a962dc034d3a2beaa9e3926d is live at https://sgg-player-archive.axie-b-ac.chatgpt.site with D1 migration 0005, SWARM_ENABLED=false, environment revision 2 and unchanged custom owner-only access. When the supported Codex in-app browser control capability is available, preserve the existing protected tab, open the exact production URL in a new muted tab and complete interactive desktop, 390px and console verification.
