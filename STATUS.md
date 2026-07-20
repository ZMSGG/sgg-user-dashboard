# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `7`  
Updated: `2026-07-20T23:03:52+08:00`  
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Open the exact live URL in a new Codex in-app browser tab without replacing the protected MFA tab, verify the MY SGG and setup-required Passport states plus console health, and retain the new tab as the delivery handoff.

## Last checkpoint

- ID: `CP-000007`
- Summary: Committed and pushed the validated source, deployed Sites Version 8 with owner-only access and environment revision 1, passed production smoke and rendered-screenshot checks, and preserved the existing MFA tab; interactive Codex in-app browser handoff remains blocked because browser control is unavailable in this session.

## Blockers

- `BLK-IN-APP-BROWSER-001` [OPEN]: The private deployment, HTTP smoke tests, worker logs, and Sites-rendered screenshot passed, but this Codex session does not expose the in-app browser control capability required to open a separate tab, inspect interactive state and console output, and retain a browser handoff. — Owner: Codex runtime capability — Unblock: Restore the Codex in-app browser control capability, then open the live URL in a new tab without navigating or closing the protected MFA tab and complete interactive dashboard, Passport, responsive, and console verification.
- `BLK-PASSPORT-CREDENTIALS-001` [OPEN]: The local and hosted configurations do not contain an approved Discord client ID, Discord client secret, or administrator Discord IDs; a strong session secret and canonical app origin are configured. — Owner: SGG identity administrator — Unblock: Create or select the approved Discord application, register the exact callback origin, configure its values through Sites without exposing them, and run real identity-isolation and administrator tests.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so personal progress and holdings remain intentionally unconnected. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting personal data.
- `BLK-RIGHTS-001` [OPEN]: The current dashboard hero is a candidate and the release icon, key visual, and social card do not have complete asset-specific rights, character, final-crop, approver, and hash evidence. — Owner: SGG creative and release approver — Unblock: Approve exact asset versions and hashes with source rights, visible character IDs and OTOMO forms, display and crop QA, reviewer, and timezone-aware approval time before public release.
- `BLK-PUBLICATION-001` [OPEN]: Owner-only private deployment is authorized and active, but public/shared access, custom domain attachment, search indexing, extra viewers or groups, and public creative approval are not authorized. — Owner: SGG project owner — Unblock: Record separate explicit owner authority and satisfy the release creative, identity, privacy, domain, rollback, and actual-screen gates before any audience expansion.

## Next actions

1. `ACT-004` [BLOCKED] When Codex in-app browser control is available, open the deployed URL in a new tab, verify the dashboard and setup-required Passport state, inspect console health, preserve the existing MFA tab, and keep the new tab as handoff. — Owner: Codex delivery operator
2. `ACT-005` [BLOCKED] Configure the approved Discord OAuth client ID, client secret, redirect URL, and administrator Discord IDs in Sites, then execute two-user and administrator isolation tests. — Owner: SGG identity administrator
3. `ACT-006` [BLOCKED] Implement side-effect-free, audience-bound, replay-protected player snapshot bridges for each game before showing personal progress or assets. — Owner: SGG game platform owner
4. `ACT-007` [BLOCKED] Record asset-specific rights, character IDs and forms, crop QA, approver, time, version, and hashes for every release visual. — Owner: SGG creative and release approver
5. `ACT-008` [BLOCKED] Request and record separate authority before public/shared access, a custom domain, search indexing, or added viewers and groups. — Owner: SGG project owner

## Resume exactly here

`ACT-004` — Read CP-000007 and the private deployment evidence, confirm Version 8 remains live and owner-only, then use Codex in-app browser control to open the live URL in a new tab while preserving the existing MFA tab; verify the dashboard, setup-required Passport state, responsive interaction, and console health before completing ACT-004.
