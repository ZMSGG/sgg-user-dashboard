# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `15`
Updated: `2026-07-22T21:26:28+08:00`
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Commit and push the exact validated Bot DM Passport source, save a new Sites version containing migration 0003, deploy it with environment revision 2 to the existing owner-only production site, and complete automated production smoke plus any available actual-screen verification without changing access.

## Last checkpoint

- ID: `CP-000015`
- Summary: Replaced the repeated Discord OAuth Client Secret dependency for ordinary players with a guild-only Bot DM one-time-code fallback while preserving OAuth as the sole high-assurance administrator path. The implementation uses a five-minute browser-bound one-time code, D1-backed attempt and rate limits, fresh guild checks, Cloudflare waitUntil delivery to remove membership timing disclosure, 24-hour low-assurance sessions, migration 0003, and explicit admin denial. Sites runtime values were configured as environment revision 2 without a Discord Client Secret; lint, typecheck, build, database validation, all 54 tests, secret scanning, backend security review, and UI review pass.

## Blockers

- `BLK-IN-APP-BROWSER-001` [OPEN]: This Codex task still does not expose the mandatory in-app browser control tool. The existing protected browser tab remains untouched, but the newly deployed version cannot be interactively opened or console-checked from this task unless that capability appears. — Owner: Codex runtime capability — Unblock: Expose the supported Codex in-app browser control capability; open the exact live URL in a new muted tab without navigating the protected tab and complete dashboard, Passport, responsive, asset, and console verification.
- `BLK-DISCORD-E2E-001` [OPEN]: Automated tests cover DM delivery, code consumption, guild re-check, session assurance, and admin denial with mocked Discord responses, but a real DM code entry and two-account isolation test require interactive access to two consenting Discord identities. — Owner: SGG project owner — Unblock: Run one real ordinary-player DM login and confirm two distinct Discord accounts cannot read each other's Passport or ledger data before expanding access beyond the current owner-only site.
- `BLK-DEPENDENCY-SHARP-001` [OPEN]: Stable Next and Miniflare still require Sharp 0.34.5, which npm audit flags for inherited libvips advisories. The built Worker has no Sharp/libvips import and the application has no untrusted image-processing path, so the documented owner-only non-reachable exception remains in force. — Owner: SGG engineering owner — Unblock: Upgrade when stable Next and Cloudflare/Miniflare officially support patched Sharp; reassess immediately if image upload or server-side untrusted processing is added.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so personal progress and holdings remain intentionally unconnected. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting personal data.
- `BLK-PUBLICATION-001` [OPEN]: Owner-only private deployment is authorized and active, but public/shared access, custom domain attachment, search indexing, extra viewers or groups, and public release remain unauthorized. — Owner: SGG project owner — Unblock: Record separate explicit owner authority and satisfy the release identity, privacy, domain, rollback, and actual-screen gates before any audience expansion.

## Next actions

1. `ACT-013` [READY] Commit and push the exact validated source, package the fresh build and migrations, save one new Sites version, and deploy it owner-only with environment revision 2. — Owner: Codex
2. `ACT-014` [READY] Run production API and access-boundary smoke checks, then open the exact deployed URL in a new muted Codex in-app browser tab for visual and console QA if the browser control capability is available. — Owner: Codex
3. `ACT-015` [BLOCKED] Complete a real DM code login and two-account isolation check when two consenting Discord test identities and interactive browser control are available. — Owner: SGG project owner
4. `ACT-012` [BLOCKED] Upgrade to stable Next and Cloudflare/Miniflare versions that officially support patched Sharp, then remove the temporary non-reachable exception. — Owner: SGG engineering owner
5. `ACT-006` [BLOCKED] Implement side-effect-free, audience-bound, replay-protected player snapshot bridges for each game before showing personal progress or assets. — Owner: SGG game platform owner
6. `ACT-008` [BLOCKED] Request and record separate authority before public/shared access, a custom domain, search indexing, or added viewers and groups. — Owner: SGG project owner

## Resume exactly here

`ACT-013` — Read CP-000015. Secure Bot DM Passport source and migration 0003 are fully validated, and Sites environment revision 2 contains the approved Bot/guild/admin/integration values plus a dedicated DM pepper without a Discord Client Secret. Commit and push this exact source, package the fresh dist output, save one new Sites version, deploy it owner-only, and run production smoke. Do not reuse or deploy Version 10.
