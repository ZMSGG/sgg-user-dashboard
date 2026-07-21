# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `10`  
Updated: `2026-07-22T00:04:28+08:00`  
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Rotate the bot token and client secret owner-side, configure all identity, guild, and integration values in Sites without exposing them, deploy the updated build with migration 0002 owner-only, and run the deployed-environment gate checklist including a second-account isolation test.

## Last checkpoint

- ID: `CP-000010`
- Summary: Added a theme-toned inline SVG wallet icon to the passport wallet card heading and link button so the optional wallet feature is visually identifiable, verified in the running dev UI after a dev-server restart (the Vite watcher had missed a case-variant CSS edit), with lint, typecheck, build, and all 27 tests passing. The owner's wallet link attempt remains pending at the MetaMask signature step; ACT-010 secret rotation and Sites configuration remain the production path.

## Blockers

- `BLK-PASSPORT-CREDENTIALS-001` [OPEN]: Local development credentials are fully configured and verified end-to-end, but the hosted Sites environment still has no Discord or integration values, and the working bot token and client secret must be rotated before production use because the bot token appeared in a session screenshot. — Owner: SGG project owner — Unblock: Rotate both secrets owner-side, configure all values through Sites without exposing them, deploy, and pass the deployed-environment gate tests including a second-account isolation test.
- `BLK-IN-APP-BROWSER-001` [OPEN]: The deployed URL has not been interactively verified; local dev verification is complete but does not substitute for the deployed environment. — Owner: Codex runtime capability — Unblock: After the next deployment, open the live URL in a new tab preserving the protected MFA tab and complete interactive dashboard, Passport, responsive, and console verification.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so personal progress and holdings remain intentionally unconnected. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting personal data.
- `BLK-RIGHTS-001` [OPEN]: The current dashboard hero is a candidate and the release icon, key visual, and social card do not have complete asset-specific rights, character, final-crop, approver, and hash evidence. — Owner: SGG creative and release approver — Unblock: Approve exact asset versions and hashes with source rights, visible character IDs and OTOMO forms, display and crop QA, reviewer, and timezone-aware approval time before public release.
- `BLK-PUBLICATION-001` [OPEN]: Owner-only private deployment is authorized and active, but public/shared access, custom domain attachment, search indexing, extra viewers or groups, and public creative approval are not authorized. — Owner: SGG project owner — Unblock: Record separate explicit owner authority and satisfy the release creative, identity, privacy, domain, rollback, and actual-screen gates before any audience expansion.

## Next actions

1. `ACT-010` [READY] Owner rotates the Discord bot token and client secret, then configures DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, ADMIN_DISCORD_IDS, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, INTEGRATION_GRANT_SECRET, and INTEGRATION_ACTOR_ID in Sites per docs/DISCORD_OPERATIONS.md. — Owner: SGG project owner
2. `ACT-009` [BLOCKED] Deploy the updated build with migration 0002 owner-only through Sites, then run the docs/DISCORD_OPERATIONS.md section-8 gate checklist including a two-account isolation test. — Owner: SGG project owner
3. `ACT-006` [BLOCKED] Implement side-effect-free, audience-bound, replay-protected player snapshot bridges for each game before showing personal progress or assets. — Owner: SGG game platform owner
4. `ACT-007` [BLOCKED] Record asset-specific rights, character IDs and forms, crop QA, approver, time, version, and hashes for every release visual. — Owner: SGG creative and release approver
5. `ACT-008` [BLOCKED] Request and record separate authority before public/shared access, a custom domain, search indexing, or added viewers and groups. — Owner: SGG project owner

## Resume exactly here

`ACT-010` — Read CP-000010; the owner rotates the bot token and client secret, configures all identity, guild, and integration values in Sites, then deploy with migration 0002 and run the section-8 gate checklist including a second-account isolation test before closing ACT-009.
