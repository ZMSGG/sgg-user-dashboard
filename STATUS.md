# Status: MY SGG — Player OS

> Derived view. `PROJECT_STATE.json` and its immutable checkpoint are authoritative.

Project ID: `PRJ-202607-sgg-user-dashboard`  
State version: `46`  
Updated: `2026-07-30T21:35:12+08:00`  
Status: `REVIEW`  
Phase: `PRIVATE_DEPLOYED`

## Current objective

Deploy the verified connection layer and the complete NFT gallery (all four collections including SEVEN GODS) through Sites, then have the owner flip the two external switches: CHAIN's Discord credentials in Vercel, and the export/pre-entry secrets in Sites after the season.

## Last checkpoint

- ID: `CP-000046`
- Summary: Owner chose the Codex-independent path and a core-member audience, so the owner-side production was actually stood up rather than left as a validated plan. Preconditions were checked on the live account rather than trusted from the runbook: wrangler is authenticated as the owner (8b32932…), sevengodsgames.com is an active zone there, and my.sevengodsgames.com resolves to nothing yet. A release commit was made first (7bb40f0). Preparing it exposed a real leak the previous Sites releases had avoided by hand: the rejected swarm lot still sat in public/, and the build copies public/ wholesale into dist/client, so 29 unapproved sprites would have shipped as fetchable production assets. They were moved to assets/rejected/swarm-v002/ with a .gitignore guard, and a clean rebuild confirms dist carries none. Then: D1 my-sgg-player-os created in APAC (d64ba138-578d-4c4b-b16d-5150de56d992), migrations 0000–0006 applied and verified remotely (all 9 expected tables present, including the 0006 cache table), the id written into wrangler.owner.jsonc, the runbook corrected to cover 0006, and the Worker deployed with both bindings resolving. It is deliberately unreachable: workers_dev stays false, wrangler reports no deploy targets, and the workers.dev host returns 404. What remains needs the owner: the Sites data export (admin login), ten secrets (values Claude must not handle), the Cloudflare Access application, and the Discord redirect URI. Access must exist before the domain is attached, or the site is briefly public — Claude will attach the domain only after Access is confirmed. BLK-DISCORD-E2E-001 still gates adding any viewer. 91 tests, lint, typecheck and a clean build pass.

## Blockers

- `BLK-IN-APP-BROWSER-001` [OPEN]: This Codex task exposes the Browser skill but not its required in-app browser control capability after mandatory discovery. The existing protected production tab remains untouched. Version 14 has Sites screenshot, production HTTP, asset-hash, HTML/CSS and Worker-log evidence, but no new muted tab, interactive 390px viewport or console session was available. — Owner: Codex runtime capability — Unblock: Expose the supported Codex in-app browser control capability, then open the exact Version 14 URL in a new muted tab without navigating or closing the protected tab and complete desktop, 390px, interaction and console verification.
- `BLK-CONCURRENT-GAME-SESSION-001` [OPEN]: A separate owner-run session implements Discord login inside the OTOMO CHAIN 7 repository; its server side is committed and deployed with the feature disabled while its web side was still uncommitted. Writing there from this session would destroy concurrent work, and that session's git housekeeping has already deleted an untracked directory created here, so generated assets are produced outside the repository until they are committed. — Owner: SGG project owner — Unblock: Confirm the OTOMO CHAIN work is committed and its export shape final before this session adapts dashboard reconciliation or edits that repository.
- `BLK-OTOMO-CHAIN-EXPORT-001` [OPEN]: OTOMO CHAIN 7 exposes external_id only through its admin-secret reward-export endpoint. The reconciliation and payout code is deployed but remains disabled until OTOMO_CHAIN_EXPORT_URL and OTOMO_CHAIN_ADMIN_SECRET are configured after season end. — Owner: SGG project owner — Unblock: After the season ends, provide the OTOMO CHAIN 7 reward-export endpoint and admin secret as Sites runtime secrets, then start with a reconciliation dry run.
- `BLK-SGP-AWARD-TABLE-001` [OPEN]: SGP amounts per final rank are an official reward decision and are not recorded. The deployed payout endpoint requires an operator-supplied award table and rejects any request without one. — Owner: SGG project owner — Unblock: Decide and record the season-0 SGP award table, then pass it explicitly to the payout dry run before any apply=true request.
- `BLK-DISCORD-E2E-001` [OPEN]: Automated tests and production smoke cover the DM protocol and fail-closed guards, but no real user DM was sent and a two-account isolation test requires interactive access to two consenting Discord identities. — Owner: SGG project owner — Unblock: Run one real ordinary-player DM login and confirm two distinct Discord accounts cannot read each other's Passport, ledger or holdings before expanding access beyond the current owner-only site.
- `BLK-PUBLICATION-001` [OPEN]: Version 14 is deployed owner-only, and public or shared access, custom domain attachment, search indexing, extra viewers or groups and public release remain unauthorized. — Owner: SGG project owner — Unblock: Record separate explicit owner authority and satisfy the release identity, privacy, domain, rollback, real-account isolation, dependency and actual-screen gates before any audience expansion.
- `BLK-PLAYER-BRIDGE-001` [OPEN]: No game currently exposes the required side-effect-free signed player snapshot contract, so in-game progress and resources remain intentionally unconnected. On-chain wallet holdings are separate and do not depend on this bridge. — Owner: SGG game platform owner — Unblock: Implement and review the documented short-lived audience-bound assertion and player snapshot contract per game before connecting in-game data.
- `BLK-DEPENDENCY-SHARP-001` [OPEN]: Stable Next and Miniflare still require Sharp 0.34.5, which npm audit flags for inherited libvips advisories. The built Worker has no Sharp or libvips import and the application has no untrusted image-processing path, so the documented owner-only non-reachable exception remains in force. — Owner: SGG engineering owner — Unblock: Upgrade when stable Next and Cloudflare or Miniflare officially support patched Sharp; reassess immediately if image upload or server-side untrusted processing is added.

## Next actions

1. `ACT-042A` [READY] Sites本番に管理者ログインし GET /api/admin/export を保存してClaudeに渡す（インポートはClaudeが実行）。 — Owner: SGG project owner
2. `ACT-042B` [READY] wrangler secret put で10個のシークレットを投入（APP_ORIGIN=https://my.sevengodsgames.com）。値はClaudeが扱えない。 — Owner: SGG project owner
3. `ACT-042C` [READY] Cloudflare Zero Trust で my.sevengodsgames.com のAccess applicationとコアメンバー許可ポリシーを作成（ドメイン接続より先）。 — Owner: SGG project owner
4. `ACT-042D` [READY] Discord Developer Portal に redirect URI https://my.sevengodsgames.com/api/auth/discord/callback を追加。 — Owner: SGG project owner
5. `ACT-042E` [BLOCKED] Access確認後、Claudeがカスタムドメインを接続し到達確認・401確認・データ突合を実施。 — Owner: Claude
6. `ACT-015` [BLOCKED] 2アカウント分離テスト（オーナー＋協力者1名）。閲覧者追加はこの後。 — Owner: SGG project owner
7. `ACT-018` [BLOCKED] After the season: set OTOMO_CHAIN_EXPORT_URL, OTOMO_CHAIN_PREENTRY_URL and OTOMO_CHAIN_ADMIN_SECRET in Sites, then dry-run stones and reconcile and payout with a decided award table. — Owner: SGG project owner
8. `ACT-024` [READY] Review the two drifted command-center policy hashes. — Owner: SGG project owner
9. `ACT-012` [BLOCKED] Sharp upgrade when supported. — Owner: SGG engineering owner
10. `ACT-006` [BLOCKED] Player snapshot bridges per game. — Owner: SGG game platform owner
11. `ACT-008` [BLOCKED] Separate authority before audience expansion. — Owner: SGG project owner

## Resume exactly here

`ACT-042A` — Owner supplies the export, the ten secrets, the Access application and the Discord redirect URI. Only then does Claude attach the domain. Nothing is reachable until that point.
