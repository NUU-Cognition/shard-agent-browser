---
description: "Catch-all for browser environment operations — health checks, config inspection/editing, and creating/configuring profiles and sessions"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start ab` if you haven't already.

# Workflow: Manage Profiles

A catch-all for operating the Agent Browser environment: check health, inspect or edit config, and create / configure profiles and sessions. Use this when the user wants to **manage the browser setup** rather than complete a specific browsing task — for that, use [[dev-sk-ab-use_browser]]. Background model in [[dev-knw-ab-modes]] (the three modes, the two knobs, the dashboard) and [[dev-knw-ab-sessions]] (session/profile mechanics).

# Input

- What the user wants to do (open-ended) — e.g. "check everything's healthy", "set up a saved profile for site X", "switch my default mode", "re-clone my real profile", "clean up sessions", "start the dashboard".

# Actions

## Stage 1: Survey & Triage

- Show the current state:
  ```bash
  flint shard ab profiles                  # managed profiles, real Chrome profiles, warm sessions, dashboard status
  agent-browser doctor --offline --quick   # CLI / Chrome / daemon health
  ```
- Read `Shards/(Shards) Local State/ab-profile-config.md` for this machine's defaults (`ab-default-mode`, session, headed, paths).
- Summarize what is configured and running, and confirm with the user **which operation(s)** to perform.
- Once the user confirms the goal, progress to the next stage.

## Stage 2: Execute the Operation

Run the matching operation(s). Pause as a human checkpoint wherever the user must sign in or make a choice.

- **Health / repair** — `agent-browser doctor` (add `--fix` for destructive repairs: reinstall Chrome, purge stale state); ensure the dashboard is up with `flint shard ab dashboard start` (http://localhost:4848).
- **Inspect / edit config** — view or edit `ab-profile-config.md` (default mode, session name, headed, profile paths, Chrome binary). To re-run setup from scratch: `flint shard setup ab --reset`, then follow [[dev-setup-ab]] and `--complete`.
- **Create / configure a profile** ([[dev-knw-ab-modes]]):
  - *Saved test identity* — `flint shard ab login saved <site>` → **user signs in (checkpoint)** → persists for future runs. Use `--name <name>` for a distinct identity.
  - *Real (user) profile* — `flint shard ab clone` (copies the user's Default; for a perfect copy, quit Chrome first), then `flint shard ab open real`.
  - *Throwaway* — `flint shard ab open throwaway` for a clean, non-persistent browser.
- **Manage sessions** — `flint shard ab open <mode>`, `flint shard ab stop <name|--all>`, `agent-browser session list`. Remember a daemon caches its launch options — to change headed/profile, stop then reopen.
- Once the operation(s) complete, progress to the next stage.

## Stage 3: Verify & Report

- Re-run `flint shard ab profiles` (and `agent-browser doctor` if health was the goal) and confirm the change took effect.
- **Report to the user**: what changed, what is now configured, and what sessions/profiles are live.
- Flag any cleanup or sensitivity: the `real-clone` holds a copy of the user's real cookies on disk (`rm -rf ~/.agent-browser/profiles/real-clone` to remove); warm sessions stay alive until stopped.
- Once the user confirms they're satisfied, the workflow is complete.

# Output

- The requested browser/profile operations performed and verified
- Updated `ab-profile-config.md` (if changed) and a summary of current profiles, sessions, and health
