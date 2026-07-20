# MY SGG durable-state migration evidence

Project ID: `PRJ-202607-sgg-user-dashboard`
Canonical managed path: `../sgg-user-dashboard` from the command center

## Pre-migration identity

- Git branch: `main`
- Git HEAD: `b0511d907a79876ccb13a02f939b100d0f20f426`
- Git remotes: none configured
- Filesystem device: `16777231`
- Project root inode: `17446802`
- The project was adopted in place. It was not relocated, replaced, symlinked, or re-created.
- The previous command-center registry path `SGG UI/sgg-user-dashboard` did not exist and was retained only as an alias.

## Pre-existing dirty implementation

The following application work already existed before the durable scaffold was promoted and remains part of the active implementation:

```text
M  .gitignore
M  .openai/hosting.json
M  README.md
M  app/Dashboard.module.css
M  app/Dashboard.tsx
M  db/schema.ts
M  docs/PLAYER_OS_ARCHITECTURE.md
M  drizzle/meta/_journal.json
M  package-lock.json
M  package.json
M  tests/rendered-html.test.mjs
?? app/api/admin/
?? app/api/auth/
?? app/api/passport/
?? app/api/wallet/
?? app/passport-contract.ts
?? drizzle/0000_brave_rachel_grey.sql
?? drizzle/meta/0000_snapshot.json
?? scripts/
?? server/
```

This inventory is evidence, not a clean-tree claim. The current working tree must remain visibly dirty until the implementation is intentionally committed.

## Gateway adoption

- Structured intake: `migration/INTAKE.json`
- Generated project ID: `PRJ-202607-sgg-user-dashboard`
- Gateway readiness at generation: `100 / 100`
- Generated staging scaffold: promoted into this existing repository using an explicit durable-file allowlist.
- The current application `README.md`, `.git`, application source, package manifests, `.openai`, and local environment files were not replaced by the generated scaffold.
- The exact pre-durable `AGENTS.md` is preserved at `migration/LEGACY_AGENTS_PRE_DURABLE.md`.
- The generated `CP-000001` is retained unchanged as historical bootstrap evidence. `CP-000002` records in-place adoption and the verified implementation state.
- The temporary staging directory was removed only after the durable files and source-reference bytes were verified in this root.

## Secret and generated-file boundary

- `.dev.vars` is ignored and was not read into migration evidence, copied, archived, or modified.
- `.env*`, dependencies, build output, Wrangler caches, and `tsconfig.tsbuildinfo` were not copied into the command center.
- `tsconfig.tsbuildinfo` and `.dev.vars` remain local ignored files and are excluded from checkpoint `changed_paths`.
- Reference media under `assets/source/` came from the gateway scaffold. They are `REFERENCE`, not project-approved release assets.

## External-state boundary

The migration changed local filesystem authority and the command-center project registry only. It did not:

- stop, restart, signal, replace, or clean up any runtime, preview, port, terminal session, or browser tab;
- create or change a Git remote, commit, push, pull request, deployment, domain, audience, secret, production database, or external message;
- approve the current candidate character art or authorize public/shared publication.

## Recovery and continuation

Git HEAD preserves the committed baseline. The pre-existing dirty implementation remains in the same inode-backed project root, and its original inventory is recorded above. Continue only from `PROJECT_STATE.json` and the latest immutable checkpoint; do not infer approval from the existence of deployed or candidate files.
