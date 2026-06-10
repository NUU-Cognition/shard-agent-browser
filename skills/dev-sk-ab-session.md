---
description: "Open or attach a persistent agent-browser session using this machine's configured profile defaults from Local State"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start ab` if you haven't already.

# Skill: Open Session

Open (or attach to) a warm `agent-browser` session in one of the shard's three modes (`saved` / `throwaway` / `real`), so cookies and auth carry across runs. The `flint shard ab open` script does this for you; this skill documents the resolution so an agent can do it directly or debug it. See [[dev-knw-ab-modes]] for the model and [[dev-knw-ab-sessions]] for the mechanics.

# Input

- A **mode** (`saved` / `throwaway` / `real`) — default from `ab-default-mode` in Local State
- (Optional) Target URL to open once the session is up
- (Optional) Session name override (default = the mode name)

# Actions

1. **Prefer the helper.** In almost all cases just run:
   ```bash
   flint shard ab open <saved|throwaway|real> [url]
   ```
   It reads Local State, resolves flags, handles the `real`-mode clone + CDP attach, and keeps the session warm. Use the steps below only to do it by hand or to debug.

2. **Read the Local State config.** Read `Shards/(Shards) Local State/ab-profile-config.md` frontmatter: `ab-default-mode`, `ab-headed`, `ab-cdp-port`, `ab-saved-path`, `ab-real-clone-path`, and optionally `ab-chrome-bin` / `ab-chrome-root` (when unset, the helpers auto-detect the platform default — see [[dev-setup-ab]]).
   - If that file is missing, or `(Shard) Agent Browser (Local).md` shows `setup: required`, the machine isn't configured — run [[dev-setup-ab]] first.

3. **Resolve the mode to a launch** (let `S` = session name, default = mode; add `--headed` when `ab-headed` is `true`):
   - `saved` → `agent-browser --session {S} --profile {ab-saved-path} [--headed] open {url}`. With a session-name override, use `~/.agent-browser/profiles/{S}` instead of `ab-saved-path` so distinct identities never share a profile dir.
   - `throwaway` → `agent-browser --session {S} [--headed] open {url}` (no `--profile`).
   - `real` → clone-and-attach (this is why the helper exists):
     1. If nothing serves CDP on `{ab-cdp-port}`, clone your Default if `{ab-real-clone-path}` is empty (copy `Local State` + `Default` minus caches), then launch **real Chrome directly**: `"{ab-chrome-bin}" --user-data-dir={ab-real-clone-path} --profile-directory=Default --remote-debugging-port={ab-cdp-port} --no-first-run --no-default-browser-check about:blank &`
     2. Wait for the CDP port, then attach: `agent-browser --session {S} connect {ab-cdp-port}` and `agent-browser --session {S} open {url}`.

4. **Mind the daemon option-cache.** If `{S}` is already warm, agent-browser reuses it and *ignores* new `--headed`/`--profile`. To change options, `flint shard ab stop {S}` (or `agent-browser --session {S} close`) first, then reopen.

5. **Confirm readiness.** `agent-browser --session {S} get url` (or `snapshot -i`) to verify, then drive it with the core loop ([[dev-knw-ab-core]]).

# Output

- A live, warm `agent-browser` session in the chosen mode, with the right profile/keychain
- Subsequent commands reuse `--session {S}` without relaunching the browser
