# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `13`  
Updated: `2026-07-22T16:30:13+08:00`  
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Validate a newly rotated Discord OAuth client secret, configure all identity, guild, and integration values in Sites without exposing them, deploy the updated build with migration 0002 owner-only, and run the deployed-environment gate checklist including a second-account isolation test.

## Last checkpoint

- ID: `CP-000013`
- Summary: Completed the owner-only predeployment hardening pass: synchronized creative V2 evidence, added per-asset generation and review timestamps, replaced the ambiguous v002 icon with an exact seven-gateway Image 2.0 v003 asset, removed every legacy unapproved public asset, made Discord guild 404 handling fail closed, added migration and real Drizzle/D1 atomicity tests, and documented the non-production-reachable Sharp advisory. Lint, typecheck, build, all 40 tests, migration validation, and secret scanning pass. The rotated bot token authenticates, but the local OAuth client secret still returns invalid_client and remains the deployment blocker.

## Blockers

- `BLK-PASSPORT-CREDENTIALS-001` [OPEN]: The newly rotated bot token authenticates as the approved MY SGG bot, but the local OAuth2 Client Secret still fails Discord client-credentials validation with invalid_client. Hosted Sites still contains no Discord or integration values. — Owner: SGG project owner — Unblock: Reset and copy the OAuth2 Client Secret from the approved Discord application, save it without disclosure, pass live validation, configure Sites, deploy, and pass the two-account isolation gate.
- `BLK-IN-APP-BROWSER-001` [OPEN]: The next deployed version has not been interactively verified in the Codex in-app browser. — Owner: Codex runtime capability — Unblock: After deployment, open the live URL in a new tab without navigating the protected Discord tab and complete dashboard, Passport, responsive, asset, and console verification.
- `BLK-DEPENDENCY-SHARP-001` [OPEN]: Stable Next and Miniflare still require Sharp 0.34.5, which npm audit flags for inherited libvips advisories. The built Worker has no Sharp/libvips import and the application has no untrusted image-processing path, so an owner-only non-reachable exception is recorded. — Owner: SGG engineering owner — Unblock: Upgrade when stable Next and Cloudflare/Miniflare officially support patched Sharp; reassess immediately if image upload or server-side untrusted processing is added.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so personal progress and holdings remain intentionally unconnected. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting personal data.
- `BLK-PUBLICATION-001` [OPEN]: Owner-only private deployment is authorized and active, but public/shared access, custom domain attachment, search indexing, extra viewers or groups, and public release remain unauthorized. — Owner: SGG project owner — Unblock: Record separate explicit owner authority and satisfy the release identity, privacy, domain, rollback, and actual-screen gates before any audience expansion.

## Next actions

1. `ACT-010` [READY] Owner resets the Discord OAuth2 Client Secret, saves it locally with scripts/set-dev-secrets.sh client-secret, and Codex live-validates it without exposing the value. — Owner: SGG project owner
2. `ACT-009` [BLOCKED] Configure the validated identity, guild, and integration values in Sites, deploy migration 0002 owner-only, then run the section-8 gate checklist including two-account isolation. — Owner: SGG project owner
3. `ACT-012` [BLOCKED] Upgrade to stable Next and Cloudflare/Miniflare versions that officially support patched Sharp, then remove the temporary non-reachable exception. — Owner: SGG engineering owner
4. `ACT-006` [BLOCKED] Implement side-effect-free, audience-bound, replay-protected player snapshot bridges for each game before showing personal progress or assets. — Owner: SGG game platform owner
5. `ACT-008` [BLOCKED] Request and record separate authority before public/shared access, a custom domain, search indexing, or added viewers and groups. — Owner: SGG project owner

## Resume exactly here

`ACT-010` — Read CP-000013. The owner resets the Discord OAuth2 Client Secret and runs scripts/set-dev-secrets.sh client-secret; Codex validates it without disclosure, configures Sites, deploys owner-only with migration 0002, and runs the deployed gate checklist.
