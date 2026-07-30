# Decisions: MY SGG — Player OS

Project ID: `PRJ-202607-sgg-user-dashboard`

| Date | Decision | Status | Reason | Decider | Affected files |
|---|---|---|---|---|---|
| 2026-07-20T22:35:18+08:00 | Create the project through `SGG_ZERO_TO_ONE_GATEWAY_V1` | CONFIRMED | Preserve a repeatable source of truth across chats | SGG product owner | All scaffold files |
| 2026-07-20T22:35:18+08:00 | Use `77` as the initial SGG time horizon | PROPOSED | Intake selection; requires project review | SGG product owner | PROJECT_PROFILE.json, PROJECT_BRIEF.md |
| 2026-07-20T22:35:18+08:00 | Use the declared GODS / OTOMO character plan | PROPOSED | Every SGG visual output requires a canonical visible character | SGG creative and release approver | WORLD_AND_CHARACTER_BRIEF.md, CREATIVE_DIRECTION.md |
| 2026-07-20T22:48:58+08:00 | Adopt the existing repository in place at `../sgg-user-dashboard` | CONFIRMED | A portable sibling path is validator-supported and preserves Git, inode, dirty implementation, and runtime continuity | SGG product owner | COMMAND_CENTER_LINK.json, PROJECT_PROFILE.json, migration/MIGRATION_EVIDENCE.md |
| 2026-07-20T22:48:58+08:00 | Use Sites as the only production source, D1 migration, version, and deployment pipeline | CONFIRMED | `.openai/hosting.json` declares logical resources and Sites owns their physical wiring; direct Wrangler deployment created conflicting authority | SGG product owner | package.json, .openai/hosting.json, drizzle/ |
| 2026-07-20T22:48:58+08:00 | Permit commit, push, packaged D1 migrations, and owner-only private deployment only | CONFIRMED | The owner explicitly requested a private deployment; public/shared access, custom domain, indexing, and added viewers remain separate | SGG project owner | rights/AUTH-SGG-USER-DASHBOARD-PRIVATE-DEPLOY-20260720-001.json |
| 2026-07-20T22:48:58+08:00 | Keep Discord Passport in setup-required state until approved credentials exist | CONFIRMED | No approved client ID, client secret, or administrator IDs are present, and missing identity configuration must fail closed | SGG product owner | server/auth.ts, app/api/passport/route.ts, PROJECT_STATE.json |
| 2026-07-21T23:40:00+08:00 | Use the newly created "MY SGG" Discord application (ID 1529130171347763311) as the approved Passport app, with one app serving both the localhost:5799 dev and production redirect URIs | CONFIRMED | Owner instructed the setup in-session; the app is private (public bot off, install link none), bot invited with zero permissions to guild 1525384497892163714 (SGG｜SEVEN GODS GAMES) | SGG project owner (in-session) | .dev.vars, docs/DISCORD_OPERATIONS.md |
| 2026-07-21T23:40:00+08:00 | Set ADMIN_DISCORD_IDS to 815074636873072661 (zm6509) and INTEGRATION_ACTOR_ID to the bot user 1529130171347763311 | CONFIRMED | The operating owner account is the sole dashboard administrator; automated grants are attributed to the bot user in granted_by | SGG project owner (in-session) | .dev.vars |
| 2026-07-22T15:59:34+08:00 | Replace the obsolete character-inclusion V1 lock with `SGG_CREATIVE_CHARACTER_USAGE_V2` and approve three purpose-built character-free Image 2.0 release assets | CONFIRMED | The owner requested the policy hash, image rights, Image 2.0 provenance, approval evidence, manifest, checkpoint, and validation to be completed without deployment; `NONE` is correct for these system/environment visuals | SGG project owner | COMMAND_CENTER_LINK.json, assets/ASSET_MANIFEST.csv, rights/RIGHTS-AND-IMAGE2-APPROVAL-20260722-001.json, public/ |
| 2026-07-22T16:21:17+08:00 | Supersede the ambiguous eight-part v002 icon with the exactly seven-part Image 2.0 v003 icon and remove all legacy unapproved public assets | CONFIRMED | Actual-image QA must match the recorded seven-gateway design and only approved assets may enter the deployable public bundle | SGG project owner | app/layout.tsx, assets/ASSET_MANIFEST.csv, rights/RIGHTS-AND-IMAGE2-APPROVAL-20260722-002.json, public/ |
| 2026-07-22T20:57:49+08:00 | Stop requesting repeated Discord Client Secret resets and add a guild-only Bot DM code fallback for ordinary Player Passport access | CONFIRMED | The approved Bot Token already verifies guild membership; a short-lived, browser-bound low-assurance DM session removes repeated owner setup while preserving OAuth as the only administrative assurance path | SGG project owner (in-session) | server/discord-dm-auth.ts, app/api/auth/discord/dm/, db/schema.ts, docs/DISCORD_OPERATIONS.md |
| 2026-07-29T02:30:00+08:00 | ダッシュボード固有のソフト通貨として SGP に加え 勾玉(MAGATAMA)・福銭(FUKUSEN) を追加し、台帳へ currency 列を導入 | CONFIRMED | オーナーの夜間指示「ゲーム内通貨のようなものをいくつか作成」。トークンではなく価格・交換価値の表示を行わない | SGG project owner (in-session) | db/schema.ts, server/currencies.ts, drizzle/0005 |
| 2026-07-29T02:30:00+08:00 | 図鑑ガチャを実装（21カード=7ペア×3形態、N100/R35/SR10、1回7勾玉） | CONFIRMED(レートはDRAFT) | オーナー指示「ガチャの仕組みのベース」。カードは本ダッシュボード限定のコスメティックで、NFT・ゲームアイテム・順位・報酬に影響しない。レート・コストは製品判断が出るまでDRAFT | SGG project owner (in-session) | server/gacha.ts, app/api/gacha/route.ts |
| 2026-07-29T02:30:00+08:00 | 公開creator-kit v1の公式キャラアートをダッシュボード表示に利用し、ホームは七柱の日替わり当番ローテーションで表示 | CONFIRMED | 全ページへキャラクターを均等配置するオーナー指示。公開済み公式アセットの表示利用であり、私的原画の直貼りには該当しない。当番表は表示順の都合でありcanonの主張ではない | SGG project owner (in-session) | public/dashboard-art/canon/, app/Dashboard.tsx |
| 2026-07-29T04:50:00+08:00 | 公式素材（creator-kit等）の runtime への直貼りを全面禁止し、全スロットを用途別の Image 2.0 新規生成へ置換する | CONFIRMED | オーナー指示。参照としての利用は許可、貼り付けは禁止。置換完了まで deploy 封鎖 | SGG project owner | scripts/creative-pipeline/, public/dashboard-art/cards/faces/ |
| 2026-07-29T18:40:00+08:00 | Codex/Sites非依存の自前デプロイ経路を準備（wrangler.owner.jsonc・/api/admin/export・import script・runbook）。切替実行までSitesが本番のまま | CONFIRMED | オーナー指示「codexは解約する可能性があるから、あなたが完結できるように」。dry-runとデータ往復検証済み | SGG project owner | wrangler.owner.jsonc, app/api/admin/export/, scripts/import-export.mjs, docs/OWNER_DEPLOY_RUNBOOK.md |

## Assumptions awaiting a decision

- No assumptions were declared in the intake.

## Open questions

- Which public hostname should be used without displacing the existing SEVENGODS Games LP at the apex domain?
