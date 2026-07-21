# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `8`  
Updated: `2026-07-21T19:01:27+08:00`  
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Configure the approved Discord application credentials (OAuth client, bot token, guild ID, administrator IDs) and the integration grant secret and actor ID through Sites without exposing values, then deploy the updated build with migration 0002 owner-only and run identity-isolation, guild-sync, and automated-grant gate tests.

## Last checkpoint

- ID: `CP-000008`
- Summary: Implemented the Discord community and automation enablement slice in source: bot-token guild membership sync with truthful NULL-means-unverified snapshots (login-time best-effort plus a cooldown-guarded manual re-sync endpoint), an HMAC-signed server-to-server automated point grant endpoint reusing the append-only idempotent ledger rules through a shared grant validator, passport guild read model and community card UI with loading, setup-required, unverified, joined, and not-joined states, generated D1 migration 0002, refreshed .dev.vars.example, and Discord operations plus point reason-code documentation. Lint, typecheck, build, and all 27 tests pass, and local in-app browser verification confirmed the fail-closed states; the new build is not yet deployed and no credentials were created or configured.

## Blockers

- `BLK-PASSPORT-CREDENTIALS-001` [OPEN]: The local and hosted configurations do not contain an approved Discord client ID, client secret, administrator Discord IDs, bot token, guild ID, integration grant secret, or integration actor ID; a strong session secret and canonical app origin are configured, and every dependent feature fails closed to a setup-required state. — Owner: SGG identity administrator — Unblock: Create or select the approved Discord application and bot, register the exact callback origin, invite the bot to the guild with no permissions, configure all values through Sites without exposing them per docs/DISCORD_OPERATIONS.md, and run real identity-isolation, guild-sync, and automated-grant tests.
- `BLK-IN-APP-BROWSER-001` [OPEN]: The deployed URL has not been interactively verified in an in-app browser tab alongside the protected MFA tab; this session interactively verified the new build on the local dev server only, not the private deployment. — Owner: Codex runtime capability — Unblock: Open the live URL in a new tab without navigating or closing the protected MFA tab and complete interactive dashboard, Passport, responsive, and console verification against the deployment.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so personal progress and holdings remain intentionally unconnected. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting personal data.
- `BLK-RIGHTS-001` [OPEN]: The current dashboard hero is a candidate and the release icon, key visual, and social card do not have complete asset-specific rights, character, final-crop, approver, and hash evidence. — Owner: SGG creative and release approver — Unblock: Approve exact asset versions and hashes with source rights, visible character IDs and OTOMO forms, display and crop QA, reviewer, and timezone-aware approval time before public release.
- `BLK-PUBLICATION-001` [OPEN]: Owner-only private deployment is authorized and active, but public/shared access, custom domain attachment, search indexing, extra viewers or groups, and public creative approval are not authorized. — Owner: SGG project owner — Unblock: Record separate explicit owner authority and satisfy the release creative, identity, privacy, domain, rollback, and actual-screen gates before any audience expansion.

## Next actions

1. `ACT-005` [BLOCKED] Configure the approved Discord OAuth client ID, client secret, redirect URL, administrator Discord IDs, bot token, guild ID, integration grant secret, and integration actor ID in Sites per docs/DISCORD_OPERATIONS.md, then execute two-user and administrator isolation tests. — Owner: SGG identity administrator
2. `ACT-009` [BLOCKED] Deploy the updated build with migration 0002 owner-only through Sites after credentials exist, then run the guild-sync, automated-grant signature, and idempotent replay gate tests recorded in docs/DISCORD_OPERATIONS.md section 8. — Owner: SGG project owner
3. `ACT-004` [BLOCKED] Open the deployed URL in a new in-app browser tab, verify the dashboard and setup-required Passport state, inspect console health, preserve the existing MFA tab, and keep the new tab as handoff. — Owner: Codex delivery operator
4. `ACT-006` [BLOCKED] Implement side-effect-free, audience-bound, replay-protected player snapshot bridges for each game before showing personal progress or assets. — Owner: SGG game platform owner
5. `ACT-007` [BLOCKED] Record asset-specific rights, character IDs and forms, crop QA, approver, time, version, and hashes for every release visual. — Owner: SGG creative and release approver
6. `ACT-008` [BLOCKED] Request and record separate authority before public/shared access, a custom domain, search indexing, or added viewers and groups. — Owner: SGG project owner

## Resume exactly here

`ACT-005` — Read CP-000008 and docs/DISCORD_OPERATIONS.md, have the owner create the approved Discord application and bot and configure all identity, guild, and integration values through Sites without exposing them, then deploy the updated build with migration 0002 owner-only and run the section-8 gate checklist before marking ACT-009 complete.
