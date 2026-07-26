# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `22`  
Updated: `2026-07-26T18:55:57+08:00`  
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Preserve the successful owner-only Version 12 deployment, have the owner complete the retained Sign in with ChatGPT handoff so production visual and console QA can finish, announce the OTOMO CHAIN link-code flow before season start, and defer reconciliation and payout until after season end and the remaining approval gates.

## Last checkpoint

- ID: `CP-000022`
- Summary: Committed the validated CP-000021 source as 10d287d02e77eba76030e5a8abf20218d807f499, pushed it to the existing Sites source main branch, saved Sites Version 12 with D1 migration 0004 for game_account_links, and deployed it successfully as appgdep_6a65e684f2d881918fe4bd31a34584ba using environment revision 2. Production smoke confirmed the MY SGG shell and confirmed that GET /api/link/otomo-chain and GET /api/holdings return 401 with NOT_AUTHENTICATED when Sites dispatch is authorized but no application session is supplied. Sites access remained custom owner-only at policy revision 1 with one allowed user, zero groups, no public access, and no custom domain; no access, environment, domain, or indexing control was changed. The exact production URL was opened in a new visible Codex in-app browser tab while existing tabs were preserved, but the owner-only Sign in with ChatGPT gate requires the owner to continue before application-screen and console QA can finish. No tournament export secret was configured, no reconciliation or payout ran, and no SGP was granted.

## Blockers

- `BLK-IN-APP-BROWSER-001` [OPEN]: Codex opened the exact Version 12 production URL in a new visible in-app browser tab and preserved all existing tabs, but the private Sites Sign in with ChatGPT gate blocks the application screen. Codex did not initiate account sign-in or claim visual and console verification without the owner's browser action. — Owner: SGG project owner and Codex delivery operator — Unblock: The owner selects Continue with ChatGPT in the retained production tab and tells Codex to continue; Codex then verifies the Version 12 dashboard, Passport, holdings, responsive layout, interaction, and console without changing the access policy.
- `BLK-OTOMO-CHAIN-EXPORT-001` [OPEN]: OTOMO CHAIN 7 exposes external_id only through its admin-secret reward-export endpoint. The reconciliation and payout code is deployed but remains disabled until OTOMO_CHAIN_EXPORT_URL and OTOMO_CHAIN_ADMIN_SECRET are configured after season end. — Owner: SGG project owner — Unblock: After the season ends, provide the OTOMO CHAIN 7 reward-export endpoint and admin secret as Sites runtime secrets, then start with a reconciliation dry run.
- `BLK-SGP-AWARD-TABLE-001` [OPEN]: SGP amounts per final rank are an official reward decision and are not recorded. The deployed payout endpoint requires an operator-supplied award table and rejects any request without one. — Owner: SGG project owner — Unblock: Decide and record the season-0 SGP award table, then pass it explicitly to the payout dry run before any apply=true request.
- `BLK-DISCORD-E2E-001` [OPEN]: Automated tests and production smoke cover the DM protocol and fail-closed guards, but no real user DM was sent and a two-account isolation test requires interactive access to two consenting Discord identities. — Owner: SGG project owner — Unblock: Run one real ordinary-player DM login and confirm two distinct Discord accounts cannot read each other's Passport, ledger, or holdings before expanding access beyond the current owner-only site.
- `BLK-PUBLICATION-001` [OPEN]: Version 12 is deployed owner-only, and public or shared access, custom domain attachment, search indexing, extra viewers or groups, and public release remain unauthorized. — Owner: SGG project owner — Unblock: Record separate explicit owner authority and satisfy the release identity, privacy, domain, rollback, real-account isolation, dependency, and actual-screen gates before any audience expansion.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so in-game progress and resources remain intentionally unconnected. On-chain wallet holdings are separate and do not depend on this bridge. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting in-game data.
- `BLK-DEPENDENCY-SHARP-001` [OPEN]: Stable Next and Miniflare still require Sharp 0.34.5, which npm audit flags for inherited libvips advisories. The built Worker has no Sharp or libvips import and the application has no untrusted image-processing path, so the documented owner-only non-reachable exception remains in force. — Owner: SGG engineering owner — Unblock: Upgrade when stable Next and Cloudflare or Miniflare officially support patched Sharp; reassess immediately if image upload or server-side untrusted processing is added.

## Next actions

1. `ACT-020` [READY] Announce the deployed link-code flow to OTOMO CHAIN 7 participants so they paste the MY SGG code into the game profile field labelled 'Discord / X など' before or from day one. — Owner: SGG project owner
2. `ACT-014` [BLOCKED] In the retained Codex in-app browser tab, have the owner select Continue with ChatGPT, then verify the exact Version 12 dashboard, Passport, holdings, responsive layout, and console health without changing access. — Owner: SGG project owner and Codex delivery operator
3. `ACT-018` [BLOCKED] After the season ends, configure OTOMO_CHAIN_EXPORT_URL and OTOMO_CHAIN_ADMIN_SECRET as Sites secrets, run reconciliation with apply omitted, resolve ambiguity manually, then run payout with an approved award table and apply omitted before any apply=true request. — Owner: SGG project owner
4. `ACT-016` [READY] Review the desktop and mobile comparison sheets, choose one candidate or a concrete shortlist, then record exact-file owner approval before any Home UI integration. — Owner: SGG project owner
5. `ACT-015` [BLOCKED] Complete a real DM code login and two-account isolation check with two consenting Discord test identities before any audience expansion. — Owner: SGG project owner
6. `ACT-012` [BLOCKED] Upgrade to stable Next and Cloudflare or Miniflare versions that officially support patched Sharp, then remove the temporary non-reachable exception. — Owner: SGG engineering owner
7. `ACT-006` [BLOCKED] Implement side-effect-free, audience-bound, replay-protected player snapshot bridges for each game before showing in-game progress or resources. — Owner: SGG game platform owner
8. `ACT-008` [BLOCKED] Request and record separate authority before public or shared access, a custom domain, search indexing, or added viewers and groups. — Owner: SGG project owner

## Resume exactly here

`ACT-020` — Read CP-000022 and deployments/PRIVATE_DEPLOYMENT-20260726-001.json. Version 12 from commit 10d287d02e77eba76030e5a8abf20218d807f499 is live at https://sgg-player-archive.axie-b-ac.chatgpt.site with environment revision 2 and D1 migration 0004. Access remains custom owner-only with one allowed user, zero groups, no public access, and no custom domain. Announce the link-code flow before season start. The retained Codex browser tab is at the Sign in with ChatGPT gate; after the owner continues, finish production visual and console QA. Do not configure export secrets or run reconciliation or payout before the season ends.
