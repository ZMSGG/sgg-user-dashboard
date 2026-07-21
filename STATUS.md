# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `9`  
Updated: `2026-07-21T23:39:40+08:00`  
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Rotate the bot token and client secret owner-side, configure all identity, guild, and integration values in Sites without exposing them, deploy the updated build with migration 0002 owner-only, and run the deployed-environment gate checklist including a second-account isolation test.

## Last checkpoint

- ID: `CP-000009`
- Summary: With the owner driving every secret and CAPTCHA step, created the approved private MY SGG Discord application (ID 1529130171347763311) with dev and production redirect URIs, a zero-permission bot invited to guild 1525384497892163714, and local credentials in .dev.vars; applied migrations 0000-0002 to the local D1; fixed a stray NUL byte in the integration signature key derivation discovered during live testing; and completed a real end-to-end verification on localhost:5799 — Discord OAuth login as the owner, login-time guild sync showing JOINED with role count and timestamp, admin recognition, and the signed integration grant API delivering +77 points with idempotent replay returning alreadyGranted and a tampered body rejected 401. Production Sites configuration, secret rotation after the in-session token exposure, and deployment of the new build remain open.

## Blockers

- `BLK-PASSPORT-CREDENTIALS-001` [OPEN]: Local development credentials are fully configured and verified end-to-end, but the hosted Sites environment still has no Discord or integration values, and the working bot token and client secret must be rotated before production use because the bot token appeared in a session screenshot. — Owner: SGG project owner — Unblock: Rotate both secrets owner-side, configure all values through Sites without exposing them, deploy, and pass the deployed-environment gate tests including a second-account isolation test.
- `BLK-IN-APP-BROWSER-001` [OPEN]: The deployed URL has not been interactively verified; local dev verification is complete but does not substitute for the deployed environment. — Owner: Codex runtime capability — Unblock: After the next deployment, open the live URL in a new tab preserving the protected MFA tab and complete interactive dashboard, Passport, responsive, and console verification.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so personal progress and holdings remain intentionally unconnected. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting personal data.
- `BLK-RIGHTS-001` [OPEN]: The current dashboard hero is a candidate and the release icon, key visual, and social card do not have complete asset-specific rights, character, final-crop, approver, and hash evidence. — Owner: SGG creative and release approver — Unblock: Approve exact asset versions and hashes with source rights, visible character IDs and OTOMO forms, display and crop QA, reviewer, and timezone-aware approval time before public release.
- `BLK-PUBLICATION-001` [OPEN]: Owner-only private deployment is authorized and active, but public/shared access, custom domain attachment, search indexing, extra viewers or groups, and public creative approval are not authorized. — Owner: SGG project owner — Unblock: Record separate explicit owner authority and satisfy the release creative, identity, privacy, domain, rollback, and actual-screen gates before any audience expansion.

## Next actions

1. `ACT-010` [READY] Owner rotates the Discord bot token and client secret (the working values were exposed to the session transcript via a screenshot and must not reach production), then configures DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, ADMIN_DISCORD_IDS, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, INTEGRATION_GRANT_SECRET, and INTEGRATION_ACTOR_ID in Sites per docs/DISCORD_OPERATIONS.md. — Owner: SGG project owner
2. `ACT-009` [BLOCKED] Deploy the updated build with migration 0002 owner-only through Sites, then run the docs/DISCORD_OPERATIONS.md section-8 gate checklist including a two-account isolation test. — Owner: SGG project owner
3. `ACT-006` [BLOCKED] Implement side-effect-free, audience-bound, replay-protected player snapshot bridges for each game before showing personal progress or assets. — Owner: SGG game platform owner
4. `ACT-007` [BLOCKED] Record asset-specific rights, character IDs and forms, crop QA, approver, time, version, and hashes for every release visual. — Owner: SGG creative and release approver
5. `ACT-008` [BLOCKED] Request and record separate authority before public/shared access, a custom domain, search indexing, or added viewers and groups. — Owner: SGG project owner

## Resume exactly here

`ACT-010` — Read CP-000009 and docs/DISCORD_OPERATIONS.md; the owner rotates the bot token and client secret, configures all identity, guild, and integration values in Sites, then deploy with migration 0002 and run the section-8 gate checklist including a second-account isolation test before closing ACT-009.
