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

## Assumptions awaiting a decision

- No assumptions were declared in the intake.

## Open questions

- Which public hostname should be used without displacing the existing SEVENGODS Games LP at the apex domain?
