# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `48`  
Updated: `2026-07-31T13:03:00+08:00`  
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Run the two-account isolation check, then add core members to the Cloudflare Access policy. Wallet linking from a wallet-capable browser remains to verify the NFT gallery on production.

## Last checkpoint

- ID: `CP-000048`
- Summary: Rotated the exposed Discord client secret, this time without the value ever entering Claude's context. The developer portal renders the secret in plaintext and the browser copy button had not been reaching the clipboard, so the value was moved out of the page by a different route: a short-lived localhost HTTP receiver on 127.0.0.1:8799, with page JavaScript POSTing the field value straight to it. Claude read only its length, probed Discord's token endpoint with it (invalid_grant, which proves the credential), uploaded it to the Worker, mirrored it into .dev.vars, then deleted the temp file and stopped the receiver; no screenshot was taken while the secret was on screen. Login was re-verified end to end after the rotation: logout, fresh authorize, callback, and /api/passport returns 200 connected with admin. BLK-SECRET-EXPOSURE-001 closes. The remaining gate before adding any core member is unchanged: the two-account isolation check.

## Blockers

- `BLK-IN-APP-BROWSER-001` [OPEN]: This Codex task exposes the Browser skill but not its required in-app browser control capability after mandatory discovery. The existing protected production tab remains untouched. Version 14 has Sites screenshot, production HTTP, asset-hash, HTML/CSS and Worker-log evidence, but no new muted tab, interactive 390px viewport or console session was available. — Owner: Codex runtime capability — Unblock: Expose the supported Codex in-app browser control capability, then open the exact Version 14 URL in a new muted tab without navigating or closing the protected tab and complete desktop, 390px, interaction and console verification.
- `BLK-CONCURRENT-GAME-SESSION-001` [OPEN]: A separate owner-run session implements Discord login inside the OTOMO CHAIN 7 repository; its server side is committed and deployed with the feature disabled while its web side was still uncommitted. Writing there from this session would destroy concurrent work, and that session's git housekeeping has already deleted an untracked directory created here, so generated assets are produced outside the repository until they are committed. — Owner: SGG project owner — Unblock: Confirm the OTOMO CHAIN work is committed and its export shape final before this session adapts dashboard reconciliation or edits that repository.
- `BLK-SGP-AWARD-TABLE-001` [OPEN]: SGP amounts per final rank are an official reward decision and are not recorded. The deployed payout endpoint requires an operator-supplied award table and rejects any request without one. — Owner: SGG project owner — Unblock: Decide and record the season-0 SGP award table, then pass it explicitly to the payout dry run before any apply=true request.
- `BLK-DISCORD-E2E-001` [OPEN]: Automated tests and production smoke cover the DM protocol and fail-closed guards, but no real user DM was sent and a two-account isolation test requires interactive access to two consenting Discord identities. — Owner: SGG project owner — Unblock: Run one real ordinary-player DM login and confirm two distinct Discord accounts cannot read each other's Passport, ledger or holdings before expanding access beyond the current owner-only site.
- `BLK-PUBLICATION-001` [OPEN]: Production moved to the owner-owned Worker at my.sevengodsgames.com behind Cloudflare Access with a single allowed email. Public or shared access, additional viewers, search indexing and public release remain unauthorized; the old Sites Version 14 stays frozen as rollback. — Owner: SGG project owner — Unblock: Record separate explicit owner authority and satisfy the release identity, privacy, domain, rollback, real-account isolation, dependency and actual-screen gates before any audience expansion.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so in-game progress and resources remain intentionally unconnected. On-chain wallet holdings are separate and do not depend on this bridge. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting in-game data.
- `BLK-DEPENDENCY-SHARP-001` [OPEN]: Stable Next and Miniflare still require Sharp 0.34.5, which npm audit flags for inherited libvips advisories. The built Worker has no Sharp or libvips import and the application has no untrusted image-processing path, so the documented owner-only non-reachable exception remains in force. — Owner: SGG engineering owner — Unblock: Upgrade when stable Next and Cloudflare or Miniflare officially support patched Sharp; reassess immediately if image upload or server-side untrusted processing is added.
- `BLK-SITES-EXPORT-UNAVAILABLE-001` [RESOLVED]: Sites Version 14 predates /api/admin/export, and its D1 lives in an account the owner cannot reach, so legacy ledger data cannot be extracted by any available means. The owner confirmed there was no real usage, so nothing of value is stranded; recording this so a future request to recover it is not attempted as if possible. — Owner: SGG project owner — Unblock: None. Confirmed unrecoverable and confirmed empty of real usage; the new production starts clean.
- `BLK-SECRET-EXPOSURE-001` [RESOLVED]: The working Discord client secret was rendered in plaintext by the developer portal and captured in a session screenshot before it could be avoided. It is valid and in use. — Owner: SGG project owner — Unblock: Done: rotated 2026-07-31 via a localhost receiver so the value never entered Claude's context, verified against Discord, and re-tested through a full login.

## Next actions

1. `ACT-015` [BLOCKED] 2アカウント分離テスト（オーナー＋協力者1名）。コアメンバー追加はこの後。 — Owner: SGG project owner
2. `ACT-044` [BLOCKED] Cloudflare Access の core-members ポリシーにコアメンバーのメールを追加。 — Owner: SGG project owner
3. `ACT-045` [READY] Wallet拡張のあるブラウザで my.sevengodsgames.com にログインしWalletを連携（NFTギャラリーの本番確認）。 — Owner: SGG project owner
4. `ACT-018` [BLOCKED] After the season: set OTOMO_CHAIN_EXPORT_URL, OTOMO_CHAIN_PREENTRY_URL and OTOMO_CHAIN_ADMIN_SECRET in Sites, then dry-run stones and reconcile and payout with a decided award table. — Owner: SGG project owner
5. `ACT-024` [READY] Review the two drifted command-center policy hashes. — Owner: SGG project owner
6. `ACT-012` [BLOCKED] Sharp upgrade when supported. — Owner: SGG engineering owner
7. `ACT-006` [BLOCKED] Player snapshot bridges per game. — Owner: SGG game platform owner
8. `ACT-008` [BLOCKED] Separate authority before audience expansion. — Owner: SGG project owner

## Resume exactly here

`ACT-015` — Production is live behind Access for one email with a freshly rotated Discord secret. Next: two-account isolation check, then core-member emails, then wallet linking.
