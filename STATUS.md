# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `36`  
Updated: `2026-07-29T17:17:36+08:00`  
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Commit the dependency-hardened approved dashboard with migration 0005, exclude every swarm sprite from the production archive, deploy privately through Sites, and verify production without changing access.

## Last checkpoint

- ID: `CP-000036`
- Summary: Hardened the private production release after the dependency audit. Next.js was upgraded from 16.2.6 to 16.2.12 and the PostCSS override from 8.5.10 to 8.5.24, clearing their fixable high-severity production advisories. The only remaining production audit finding is the already documented Sharp/libvips exception: the application does not import Sharp in the built Worker and exposes no untrusted server-side image-processing path, while the current stable Next and Miniflare dependency ranges still resolve Sharp 0.34.5. Lint, typecheck, build, 83 tests and the Drizzle migration check all pass after the upgrade. Production remains Sites Version 13; the release still requires the exact source commit, swarm-free clean build, saved Sites version and owner-only deployment.

## Blockers

- `BLK-CONCURRENT-GAME-SESSION-001` [OPEN]: A separate owner-run session implements Discord login inside the OTOMO CHAIN 7 repository; its server side is committed and deployed with the feature disabled while its web side was still uncommitted. Writing there from this session would destroy concurrent work, and that session's git housekeeping has already deleted an untracked directory created here, so generated assets are produced outside the repository until they are committed. — Owner: SGG project owner — Unblock: Confirm the OTOMO CHAIN work is committed and its export shape final before this session adapts dashboard reconciliation or edits that repository.
- `BLK-OTOMO-CHAIN-EXPORT-001` [OPEN]: OTOMO CHAIN 7 exposes external_id only through its admin-secret reward-export endpoint. The reconciliation and payout code is deployed but remains disabled until OTOMO_CHAIN_EXPORT_URL and OTOMO_CHAIN_ADMIN_SECRET are configured after season end. — Owner: SGG project owner — Unblock: After the season ends, provide the OTOMO CHAIN 7 reward-export endpoint and admin secret as Sites runtime secrets, then start with a reconciliation dry run.
- `BLK-SGP-AWARD-TABLE-001` [OPEN]: SGP amounts per final rank are an official reward decision and are not recorded. The deployed payout endpoint requires an operator-supplied award table and rejects any request without one. — Owner: SGG project owner — Unblock: Decide and record the season-0 SGP award table, then pass it explicitly to the payout dry run before any apply=true request.
- `BLK-DISCORD-E2E-001` [OPEN]: Automated tests and production smoke cover the DM protocol and fail-closed guards, but no real user DM was sent and a two-account isolation test requires interactive access to two consenting Discord identities. — Owner: SGG project owner — Unblock: Run one real ordinary-player DM login and confirm two distinct Discord accounts cannot read each other's Passport, ledger, or holdings before expanding access beyond the current owner-only site.
- `BLK-PUBLICATION-001` [OPEN]: Version 13 is deployed owner-only, and public or shared access, custom domain attachment, search indexing, extra viewers or groups, and public release remain unauthorized. — Owner: SGG project owner — Unblock: Record separate explicit owner authority and satisfy the release identity, privacy, domain, rollback, real-account isolation, dependency, and actual-screen gates before any audience expansion.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so in-game progress and resources remain intentionally unconnected. On-chain wallet holdings are separate and do not depend on this bridge. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting in-game data.
- `BLK-DEPENDENCY-SHARP-001` [OPEN]: Stable Next and Miniflare still require Sharp 0.34.5, which npm audit flags for inherited libvips advisories. The built Worker has no Sharp or libvips import and the application has no untrusted image-processing path, so the documented owner-only non-reachable exception remains in force. — Owner: SGG engineering owner — Unblock: Upgrade when stable Next and Cloudflare or Miniflare officially support patched Sharp; reassess immediately if image upload or server-side untrusted processing is added.

## Next actions

1. `ACT-035` [READY] Commit, push, save and privately deploy the approved release through Sites, then record production evidence. — Owner: Codex
2. `ACT-033` [READY] Review the replacement mochi swarm separately; keep it disabled and outside production until explicitly approved. — Owner: SGG project owner
3. `ACT-022` [READY] Set the OTOMO CHAIN Discord credentials in Vercel. — Owner: SGG project owner
4. `ACT-024` [READY] Review the two drifted command-center policy hashes. — Owner: SGG project owner
5. `ACT-015` [BLOCKED] Two-account isolation check before adding any viewer. — Owner: SGG project owner
6. `ACT-021` [BLOCKED] Adapt reconciliation to verified Discord IDs when the game work lands. — Owner: SGG project owner
7. `ACT-018` [BLOCKED] Post-season export secrets, reconcile, pay out with a decided award table. — Owner: SGG project owner
8. `ACT-012` [BLOCKED] Sharp upgrade when supported. — Owner: SGG engineering owner
9. `ACT-006` [BLOCKED] Player snapshot bridges per game. — Owner: SGG game platform owner
10. `ACT-008` [BLOCKED] Separate authority before audience expansion. — Owner: SGG project owner

## Resume exactly here

`ACT-035` — Create the exact approved release commit without public/dashboard-art/swarm, push it to the existing Sites source branch, build from that exact commit, package migration 0005, save and privately deploy, then verify production and record the deployment.
