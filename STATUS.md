# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `26`  
Updated: `2026-07-28T17:15:00+08:00`  
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Investigate, without changing Sites or Cloudflare state or revealing secret values, whether the production Worker and D1 can be handed over from Sites to an owner-controlled Cloudflare deployment path, and record only verified facts in docs/DEPLOY_HANDOVER_FACTS.md.

## Last checkpoint

- ID: `CP-000026`
- Summary: Committed the approved CP-000025 Home rebuild as 7e725f499cd47313b5bb1776b304873a99f71514, pushed that exact commit to the existing Sites source main branch, saved Sites Version 13, and deployed it successfully as appgdep_6a6871daa8bc8191b05c07c956f9ae47 with environment revision 2. Sites access remained custom owner-only at policy revision 1 with one allowed user, zero groups, no public access, and no custom domain; no access, owner, group, environment, domain, or indexing control was changed. Production verification confirmed anonymous GET /api/passport returns 401, all six approved Image 2.0 assets return 200 and exactly match the approval hashes, the four-GODS hero appears in the Version 13 screenshot, the five card titles and right rail are in the production HTML, the 390px production CSS exposes the single mobile navigation while hiding the duplicate dock, and no recent Worker errors were present. The mandatory in-app browser control capability is unavailable in this task, so a new muted tab, interactive responsive viewport, and console verification remain explicitly unclaimed. The two known command-center policy hash drifts remain unresolved and were not refreshed.

## Blockers

- `BLK-IN-APP-BROWSER-001` [OPEN]: This Codex task exposes the Browser skill but not its required in-app browser control capability after mandatory discovery. The existing protected production tab remains untouched. Version 13 has Sites screenshot, production HTTP, asset, HTML/CSS, and Worker-log evidence, but no new muted tab, interactive 390px viewport, or console session was available. — Owner: Codex runtime capability — Unblock: Expose the supported Codex in-app browser control capability, then open the exact Version 13 URL in a new muted tab without navigating or closing the protected tab and complete desktop, 390px, interaction, and console verification.
- `BLK-CONCURRENT-GAME-SESSION-001` [OPEN]: A separate owner-run session implements Discord login inside the OTOMO CHAIN 7 repository; its server side is committed and deployed with the feature disabled while its web side was still uncommitted. Writing there from this session would destroy concurrent work, and that session's git housekeeping has already deleted an untracked directory created here, so generated assets are produced outside the repository until they are committed. — Owner: SGG project owner — Unblock: Confirm the OTOMO CHAIN work is committed and its export shape final before this session adapts dashboard reconciliation or edits that repository.
- `BLK-OTOMO-CHAIN-EXPORT-001` [OPEN]: OTOMO CHAIN 7 exposes external_id only through its admin-secret reward-export endpoint. The reconciliation and payout code is deployed but remains disabled until OTOMO_CHAIN_EXPORT_URL and OTOMO_CHAIN_ADMIN_SECRET are configured after season end. — Owner: SGG project owner — Unblock: After the season ends, provide the OTOMO CHAIN 7 reward-export endpoint and admin secret as Sites runtime secrets, then start with a reconciliation dry run.
- `BLK-SGP-AWARD-TABLE-001` [OPEN]: SGP amounts per final rank are an official reward decision and are not recorded. The deployed payout endpoint requires an operator-supplied award table and rejects any request without one. — Owner: SGG project owner — Unblock: Decide and record the season-0 SGP award table, then pass it explicitly to the payout dry run before any apply=true request.
- `BLK-DISCORD-E2E-001` [OPEN]: Automated tests and production smoke cover the DM protocol and fail-closed guards, but no real user DM was sent and a two-account isolation test requires interactive access to two consenting Discord identities. — Owner: SGG project owner — Unblock: Run one real ordinary-player DM login and confirm two distinct Discord accounts cannot read each other's Passport, ledger, or holdings before expanding access beyond the current owner-only site.
- `BLK-PUBLICATION-001` [OPEN]: Version 13 is deployed owner-only, and public or shared access, custom domain attachment, search indexing, extra viewers or groups, and public release remain unauthorized. — Owner: SGG project owner — Unblock: Record separate explicit owner authority and satisfy the release identity, privacy, domain, rollback, real-account isolation, dependency, and actual-screen gates before any audience expansion.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so in-game progress and resources remain intentionally unconnected. On-chain wallet holdings are separate and do not depend on this bridge. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting in-game data.
- `BLK-DEPENDENCY-SHARP-001` [OPEN]: Stable Next and Miniflare still require Sharp 0.34.5, which npm audit flags for inherited libvips advisories. The built Worker has no Sharp or libvips import and the application has no untrusted image-processing path, so the documented owner-only non-reachable exception remains in force. — Owner: SGG engineering owner — Unblock: Upgrade when stable Next and Cloudflare or Miniflare officially support patched Sharp; reassess immediately if image upload or server-side untrusted processing is added.

## Next actions

1. `ACT-027` [READY] Complete the read-only Sites-to-Cloudflare deployment handover investigation and record verified facts in docs/DEPLOY_HANDOVER_FACTS.md without exposing secret values. — Owner: Codex deployment handover investigator
2. `ACT-026` [BLOCKED] When supported Codex in-app browser control is available, open Version 13 in a new muted tab without touching the protected existing tab and complete interactive desktop, 390px, and console verification. — Owner: Codex runtime capability
3. `ACT-022` [READY] Add the OTOMO CHAIN redirect URI to the approved MY SGG Discord application and set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in the OTOMO CHAIN Vercel project so discord_enabled becomes true. — Owner: SGG project owner
4. `ACT-024` [READY] Review the two drifted command-center policy files (OTOMO_FORM_BALANCE_V1.md and canon/TERMINOLOGY.md, both changed 2026-07-26 19:33) and refresh their recorded hashes deliberately; validation fails until then. — Owner: SGG project owner
5. `ACT-015` [BLOCKED] Complete the two-account isolation check with two consenting Discord identities before adding any viewer; docs/CORE_MEMBER_RELEASE_CHECKLIST.md has the procedure and tests/two-account-isolation.test.mjs covers the implementation. — Owner: SGG project owner
6. `ACT-021` [BLOCKED] Adapt dashboard reconciliation to the game's verified Discord ID after the concurrent OTOMO CHAIN work is committed. — Owner: SGG project owner
7. `ACT-018` [BLOCKED] After the season ends on 2026-08-08T00:00:00Z, configure the OTOMO CHAIN export secrets, run the reconcile dry run, resolve anything ambiguous by hand, then run the payout dry run with a decided award table before applying. — Owner: SGG project owner
8. `ACT-012` [BLOCKED] Upgrade to stable Next and Cloudflare or Miniflare versions that officially support patched Sharp. — Owner: SGG engineering owner
9. `ACT-006` [BLOCKED] Implement side-effect-free, audience-bound, replay-protected player snapshot bridges per game before showing in-game progress. — Owner: SGG game platform owner
10. `ACT-008` [BLOCKED] Request and record separate authority before public or shared access, a custom domain, search indexing, or added viewers and groups. — Owner: SGG project owner

## Resume exactly here

`ACT-027` — Read CP-000026 and deployments/PRIVATE_DEPLOYMENT-20260728-001.json. Version 13 from commit 7e725f499cd47313b5bb1776b304873a99f71514 is live at https://sgg-player-archive.axie-b-ac.chatgpt.site with environment revision 2 and unchanged custom owner-only access. Investigate the Sites-to-Cloudflare handover using read-only Sites metadata, local configuration, and official Cloudflare documentation; record only verified facts and environment variable names in docs/DEPLOY_HANDOVER_FACTS.md, write 不明 where evidence is insufficient, and make no external change.
