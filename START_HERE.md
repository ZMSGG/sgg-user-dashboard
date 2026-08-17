# Start here: MY SGG — Player OS

## Read in this order

1. `AGENTS.md`
2. `COMMAND_CENTER_LINK.json`
3. `PROJECT_PROFILE.json`
4. `PROJECT_STATE.json`
5. the immutable checkpoint named by `last_checkpoint_path`
6. `VALIDATION_REPORT.json`
7. `WORLD_AND_CHARACTER_BRIEF.md`
8. `PROJECT_BRIEF.md`
9. `EXPERIENCE_BLUEPRINT.md`
10. `CREATIVE_DIRECTION.md`
11. `DECISIONS.md`

## First vertical slice

公開hub → live状態とranking → 大会とcollectionのtruthful state → Discord Passport → 任意Wallet → append-only points → mobile and security review

## Before implementation

- Recalculate kickoff readiness; do not trust the stored score alone.
- Confirm policy hashes and character IDs against the command center.
- Treat rights status `PENDING` as recordkeeping metadata, not a production or release gate.
- Keep the first release within the declared scope and `77`-day horizon.

## Validation

```bash
python3 "../SGG　司令塔/launches/tools/validate_sgg_project.py" . --kickoff
python3 "../SGG　司令塔/launches/tools/validate_pack.py" .
```

Release validation is separate and requires explicit human approvals:

```bash
python3 "../SGG　司令塔/launches/tools/validate_sgg_project.py" . --release
```

After any material change, persist the current result before stopping:

```bash
python3 "../SGG　司令塔/launches/tools/checkpoint_project.py" . --update /path/to/checkpoint-update.json
python3 "../SGG　司令塔/launches/tools/checkpoint_project.py" . --update /path/to/checkpoint-update.json --write
python3 "../SGG　司令塔/launches/tools/validate_sgg_project.py" . --kickoff --record
```
