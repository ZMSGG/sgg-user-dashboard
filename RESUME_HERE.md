# Resume from filesystem: MY SGG — Player OS

Do not use an earlier chat, context summary, or model memory as project state.

1. Read `AGENTS.md` and resolve `COMMAND_CENTER_LINK.json`.
2. Read stable intent from `PROJECT_PROFILE.json`.
3. Read current work from `PROJECT_STATE.json`.
4. Open the exact file named by `last_checkpoint_path` and confirm it matches the state.
5. Confirm `VALIDATION_REPORT.json` fingerprints are current.
6. Execute only the action named by `resume.action_id`.

Machine-check this reconstruction with:

```bash
python3 "../SGG　司令塔/launches/tools/resume_sgg_project.py" .
```

After material work, checkpoint and record validation before stopping. If these files do not reconstruct the task without conversation history, stop and repair the durable state first.
