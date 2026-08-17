# SGG project instructions

This file applies to this folder and everything below it.

## Required read order

1. `COMMAND_CENTER_LINK.json`
2. `PROJECT_PROFILE.json`
3. `PROJECT_STATE.json`
4. the file named by `PROJECT_STATE.json:last_checkpoint_path`
5. `VALIDATION_REPORT.json`
6. `START_HERE.md`
7. `WORLD_AND_CHARACTER_BRIEF.md`
8. `DECISIONS.md`

Resolve the command center with `COMMAND_CENTER_LINK.json`; do not embed or rely on a personal absolute path. Follow `SGG_ZERO_TO_ONE_GATEWAY_V1`, `SGG_DURABLE_PROJECT_STATE_V1`, `SGG_CREATIVE_CHARACTER_USAGE_V2`, and `OTOMO_FORM_BALANCE_V1`. If the command center, state checkpoint, policy lock, or canon cannot be resolved, stop and report the missing source.

The chat, context window, conversation summary, and model memory are disposable interfaces and are never project authority. Before the first mutation, reconstruct the task from the filesystem state. After every material decision, milestone, blocker change, or work stoppage, create a new immutable checkpoint with `checkpoint_project.py`, then run `validate_sgg_project.py --record`. Do not end changed work with unrecorded state.

## Character usage and creative evidence

- Select `NONE / GODS / OTOMO / BOTH` per asset purpose. Environment, architecture, background, texture, prop, and UI-component assets do not require decorative characters.
- Record Image 2.0 provenance, source rights, purpose, final-crop visual check, reviewer, timezone-aware review time, version, and final hash for every production image.
- When characters are used, also record family, canonical ID, reference, OTOMO form, and character-specific rights.
- Do not paste private source art into public work. Record rights metadata, but do not block generation, approval, repository visibility, publication, release, push, or deployment solely because rights are `PENDING`.
- Do not mark a non-compliant visual approved, complete, deliverable, or publishable.

## Canon and delivery boundaries

- Do not invent official ages, histories, abilities, relationships, enemies, religion, token terms, reward values, or season dates.
- Keep project-only assumptions separate from verified canon in `DECISIONS.md`.
- Creating this folder does not authorize publishing, sending, deploying, or production changes.
- Start with the vertical slice in `EXPERIENCE_BLUEPRINT.md`; do not claim unimplemented work is complete.
