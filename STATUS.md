# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `21`  
Updated: `2026-07-26T18:42:54+08:00`  
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Deploy the OTOMO CHAIN 7 link code before the season-0 start at 2026-07-27T00:00:00Z so participants can bind their game account from day one, then reconcile and pay out SGP only after the season ends, the admin export secret is configured, an award table is decided, and the documented manual top-N review is complete.

## Last checkpoint

- ID: `CP-000021`
- Summary: Verified the SGG contract set directly on Ethereum mainnet and implemented display-only wallet holdings. Reading name, symbol and total supply over public RPC confirmed SEVEN GODS (GOD, 3041), OTOMO SEIREITAI (10000), OTOMO JUNIKUTAI (2180), OTOMO DOUJI (518), and Seven DAO Token (SDT, 18 decimals, 777,000,000). This corrects an earlier finding: SDT is deployed on chain at an owner-supplied address, and the previous conclusion that it did not exist reflected only the absence of any record in the repositories. The single-sourced SEVENGODS address is confirmed genuine, closing BLK-GODS-CONTRACT-001. Added server/onchain-holdings.ts and GET /api/holdings, which read balanceOf over public RPC with no indexer and no API key, take the address from the server-side player row so a browser cannot request another player's holdings, truncate rather than round so a balance is never overstated, and render a failed read as unknown rather than zero. No price, valuation, or SGG Token claim is displayed, and holdings never affect rank, SGP, or eligibility. Lint, typecheck, production build, and 70 tests pass; the endpoint and the rendered Vault section were verified against the real linked wallet on localhost:5799 with no console errors. No commit, deployment, access change, or point grant occurred.

## Blockers

- `BLK-OTOMO-CHAIN-EXPORT-001` [OPEN]: OTOMO CHAIN 7 exposes external_id only through its admin-secret reward-export endpoint; the public leaderboards return player_id and display_name only. The reconciliation and payout code is implemented and tested but stays disabled with a 503 until OTOMO_CHAIN_EXPORT_URL and OTOMO_CHAIN_ADMIN_SECRET are configured as owner-approved Sites secrets. — Owner: SGG project owner — Unblock: Provide the OTOMO CHAIN 7 reward-export endpoint and admin secret as Sites runtime secrets after the season ends.
- `BLK-SGP-AWARD-TABLE-001` [OPEN]: SGP amounts per final rank are an official reward decision and are not recorded anywhere. The payout endpoint therefore requires an operator-supplied award table and rejects any request without one; no default exists and none may be invented. — Owner: SGG project owner — Unblock: Decide and record the season-0 SGP award table, then pass it explicitly to the payout dry run before applying.
- `BLK-DISCORD-E2E-001` [OPEN]: Automated tests and production smoke cover the DM protocol and fail-closed guards, but no real user DM was sent and a two-account isolation test requires interactive access to two consenting Discord identities. — Owner: SGG project owner — Unblock: Run one real ordinary-player DM login and confirm two distinct Discord accounts cannot read each other's Passport, ledger, or holdings before expanding access beyond the current owner-only site.
- `BLK-PUBLICATION-001` [OPEN]: The deployment is owner-only private, and public or shared access, custom domain attachment, search indexing, extra viewers or groups, and public release remain unauthorized. Sites access control is expressed per ChatGPT account and cannot express Discord guild membership, so a guild-limited audience necessarily means public Sites access plus an application-level guild gate, which enlarges rather than reduces this gate. — Owner: SGG project owner — Unblock: Record separate explicit owner authority and satisfy the release identity, privacy, domain, rollback, real-account isolation, dependency, and actual-screen gates before any audience expansion.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so in-game progress and resources remain intentionally unconnected. On-chain wallet holdings are a separate, self-contained source and do not depend on this bridge. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting in-game data.
- `BLK-DEPENDENCY-SHARP-001` [OPEN]: Stable Next and Miniflare still require Sharp 0.34.5, which npm audit flags for inherited libvips advisories. The built Worker has no Sharp or libvips import and the application has no untrusted image-processing path, so the documented owner-only non-reachable exception remains in force. — Owner: SGG engineering owner — Unblock: Upgrade when stable Next and Cloudflare or Miniflare officially support patched Sharp; reassess immediately if image upload or server-side untrusted processing is added.
- `BLK-IN-APP-BROWSER-001` [OPEN]: The deployed production version has been verified through HTTP API and asset smoke but not an interactive rendered browser session. The link-code, reconciliation, and holdings work was verified on the local dev server, not on production. — Owner: Codex runtime capability — Unblock: Open the exact live URL in a new muted tab without navigating the protected tab and complete dashboard, Passport, responsive, asset, focus, and console verification.

## Next actions

1. `ACT-017` [READY] Deploy the link-code capability, on-chain holdings, and D1 migration 0004 through Sites before 2026-07-27T00:00:00Z, without altering access mode or audience. — Owner: SGG project owner
2. `ACT-020` [READY] Announce the link code to OTOMO CHAIN 7 participants so they paste it into the game profile field labelled 'Discord / X など' from day one. — Owner: SGG project owner
3. `ACT-018` [BLOCKED] After the season ends, configure OTOMO_CHAIN_EXPORT_URL and OTOMO_CHAIN_ADMIN_SECRET as Sites secrets, run the reconcile dry run, resolve anything ambiguous by hand, then run the payout dry run with a decided award table before applying. — Owner: SGG project owner
4. `ACT-016` [READY] Review the desktop and mobile comparison sheets, choose one candidate or a concrete shortlist, then record exact-file owner approval before any Home UI integration. — Owner: SGG project owner
5. `ACT-015` [BLOCKED] Complete a real DM code login and two-account isolation check with two consenting Discord test identities before any audience expansion. — Owner: SGG project owner
6. `ACT-012` [BLOCKED] Upgrade to stable Next and Cloudflare or Miniflare versions that officially support patched Sharp, then remove the temporary non-reachable exception. — Owner: SGG engineering owner
7. `ACT-006` [BLOCKED] Implement side-effect-free, audience-bound, replay-protected player snapshot bridges for each game before showing in-game progress or resources. — Owner: SGG game platform owner
8. `ACT-008` [BLOCKED] Request and record separate authority before public or shared access, a custom domain, search indexing, or added viewers and groups. — Owner: SGG project owner
9. `ACT-014` [BLOCKED] When Codex in-app browser control is available, open the deployed URL in a new muted tab, preserve the existing protected tab, and complete visual, responsive, interaction, and console QA. — Owner: Codex runtime capability

## Resume exactly here

`ACT-017` — Deploy the current source and D1 migration 0004 through the Sites source and version workflow before 2026-07-27T00:00:00Z, changing no access setting, then announce the link code to participants. After the season ends on 2026-08-03T00:00:00Z, configure the export secrets, run POST /api/admin/tournament/reconcile with apply omitted, resolve any ambiguous or conflicting entries by hand, then run POST /api/admin/tournament/payout with a decided award table and apply omitted before ever setting apply to true.
