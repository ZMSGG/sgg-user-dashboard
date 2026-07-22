# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `16`
Updated: `2026-07-22T21:31:52+08:00`
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Preserve the successful owner-only Version 11 deployment and complete the remaining interactive actual-screen, real DM login, and two-account isolation gates when the required Codex browser capability and consenting test identities are available; do not expand access meanwhile.

## Last checkpoint

- ID: `CP-000016`
- Summary: Committed secure Bot DM Passport source as 713ef7131e2055a8a63e84cd5a42fe48d6b3215f, pushed it to the existing private Sites source main branch, saved Sites Version 11 (appgprj_6a54d2460e7c8191a92c00900d810ab1~appgver_667daa3c0874819184850f109ac83336) with migration 0003, and deployed it successfully as appgdep_6a60c581d3b48191b968abe1d92e845a using environment revision 2. Production remains custom owner-only access with one allowed user and zero groups. Automated production smoke confirmed the shell, all 18 referenced assets, current live read model, anonymous Passport authMethods oauth=false/dmOtp=true, 202 DM start with a 300-second Strict HttpOnly Secure nonce, generic failed verification, 401 admin/integration guards, and security headers. No real user DM was sent. In-app browser control remains unavailable, so actual-screen/console QA and the real two-account gate remain open rather than being claimed complete.

## Blockers

- `BLK-IN-APP-BROWSER-001` [OPEN]: This Codex task does not expose the mandatory in-app browser control or open_in_codex capability. The existing protected browser tab remains untouched, and Version 11 has been verified through production HTTP/API/asset smoke but not an interactive rendered browser or console session. — Owner: Codex runtime capability — Unblock: Expose the supported Codex in-app browser control capability; open the exact live URL in a new muted tab without navigating the protected tab and complete dashboard, Passport, responsive, asset, focus, and console verification.
- `BLK-DISCORD-E2E-001` [OPEN]: Automated tests and production smoke cover the DM protocol and fail-closed guards, but no real user DM was sent and a two-account isolation test requires interactive access to two consenting Discord identities. — Owner: SGG project owner — Unblock: Run one real ordinary-player DM login and confirm two distinct Discord accounts cannot read each other's Passport or ledger data before expanding access beyond the current owner-only site.
- `BLK-DEPENDENCY-SHARP-001` [OPEN]: Stable Next and Miniflare still require Sharp 0.34.5, which npm audit flags for inherited libvips advisories. The built Worker has no Sharp/libvips import and the application has no untrusted image-processing path, so the documented owner-only non-reachable exception remains in force. — Owner: SGG engineering owner — Unblock: Upgrade when stable Next and Cloudflare/Miniflare officially support patched Sharp; reassess immediately if image upload or server-side untrusted processing is added.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so personal progress and holdings remain intentionally unconnected. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting personal data.
- `BLK-PUBLICATION-001` [OPEN]: Version 11 is deployed successfully with owner-only private access, but public/shared access, custom domain attachment, search indexing, extra viewers or groups, and public release remain unauthorized. — Owner: SGG project owner — Unblock: Record separate explicit owner authority and satisfy the release identity, privacy, domain, rollback, real-account isolation, dependency, and actual-screen gates before any audience expansion.

## Next actions

1. `ACT-014` [BLOCKED] When Codex in-app browser control is available, open the deployed URL in a new muted tab, preserve the existing protected tab, and complete visual, responsive, interaction, and console QA. — Owner: Codex runtime capability
2. `ACT-015` [BLOCKED] Complete a real DM code login and two-account isolation check with two consenting Discord test identities before any audience expansion. — Owner: SGG project owner
3. `ACT-012` [BLOCKED] Upgrade to stable Next and Cloudflare/Miniflare versions that officially support patched Sharp, then remove the temporary non-reachable exception. — Owner: SGG engineering owner
4. `ACT-006` [BLOCKED] Implement side-effect-free, audience-bound, replay-protected player snapshot bridges for each game before showing personal progress or assets. — Owner: SGG game platform owner
5. `ACT-008` [BLOCKED] Request and record separate authority before public/shared access, a custom domain, search indexing, or added viewers and groups. — Owner: SGG project owner

## Resume exactly here

`ACT-014` — Read CP-000016. Version 11 from commit 713ef7131e2055a8a63e84cd5a42fe48d6b3215f is live at https://sgg-player-archive.axie-b-ac.chatgpt.site with environment revision 2, migration 0003, DM auth enabled, OAuth intentionally disabled, and custom owner-only access (one user, zero groups). Automated production smoke passed. Do not redeploy unchanged source. When browser control becomes available, open this exact URL in a new muted Codex tab without touching existing tabs and finish actual-screen/console QA; then run a real DM login and two-account isolation gate with consenting identities.
