# Setup Agent Browser

One-time, per-machine setup for the Agent Browser shard. Two parts: (1) install the `agent-browser` CLI + browser runtime, and (2) record this machine's default **mode** and paths so the `flint shard ab` helpers work. This is `setup: local` — config is stored, gitignored, in `Shards/(Shards) Local State/ab-profile-config.md`. See [[dev-knw-ab-modes]] for the model.

# Prerequisites

- Node.js (current LTS) and `npm` on PATH
- Network access to install the npm package and the bundled browser
- A Chromium-capable environment (macOS, Linux, or Windows)
- Google Chrome installed if you want `real` mode (real OS keystore / clone of your profile)

# Actions

## Part 1 — Install the CLI

1. **Install the CLI globally.**
   ```bash
   npm i -g agent-browser
   ```
2. **Install the managed browser runtime.**
   ```bash
   agent-browser install
   ```
3. **Confirm the install is healthy.**
   ```bash
   agent-browser doctor
   ```
   On failure, run `agent-browser doctor --fix`, then re-run `doctor`.

## Part 2 — Record the Default Mode (companion config)

4. **Mark the managed setup-state complete FIRST.** This flips the installer-managed marker `(Shard) Agent Browser (Local).md` to `setup: completed`:
   ```bash
   flint shard setup ab --complete
   ```
   > The marker is **regenerated on every install/reinstall** — it only keeps `id`/`tags`/`setup`. Never store config there; the durable config goes in the companion file next.

5. **Write the companion config.** Create/edit `Shards/(Shards) Local State/ab-profile-config.md` (the installer does not touch this file, so it survives reinstalls). Reasonable defaults (macOS shown):
   ```yaml
   ---
   ab-default-mode: saved          # saved | throwaway | real  (saved = safe default; does not copy real cookies)
   ab-headed: true
   ab-cdp-port: 9222               # real mode CDP attach port
   ab-saved-path: ~/.agent-browser/profiles/flint
   ab-real-clone-path: ~/.agent-browser/profiles/real-clone
   ab-chrome-bin: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
   ab-chrome-root: ~/Library/Application Support/Google/Chrome
   ---
   ```
   `ab-chrome-bin` and `ab-chrome-root` are **optional** — when omitted, the helpers auto-detect the platform default:

   | Platform | Chrome binary (default) | Profile root (default) |
   |----------|------------------------|------------------------|
   | macOS | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` | `~/Library/Application Support/Google/Chrome` |
   | Linux | first of `google-chrome`, `google-chrome-stable`, `chromium`, `chromium-browser` in `/usr/bin` (or `/snap/bin/chromium`) | `~/.config/google-chrome` |
   | Windows | `chrome.exe` under `%PROGRAMFILES%`, `%PROGRAMFILES(X86)%`, or `%LOCALAPPDATA%` | `%LOCALAPPDATA%\Google\Chrome\User Data` |

   Set them explicitly only when Chrome lives somewhere unusual (Chromium, Chrome Beta, a portable install). The three modes (`saved` / `throwaway` / `real`) are explained in [[dev-knw-ab-modes]]. There is nothing else to pick now — modes are chosen per-invocation via `flint shard ab open <mode>`.

6. **(Optional) Prime a mode now.**
   - **saved** — log into a reusable test identity once: `flint shard ab login saved <your test site>`.
   - **real** — seed your real logins and attach: `flint shard ab clone` then `flint shard ab open real`. (`clone` copies sensitive cookies; for a perfect copy, quit Chrome first.)
   - **dashboard** — `flint shard ab dashboard start` to watch sessions at http://localhost:4848.

# Verification

- `agent-browser --version` prints a version and `agent-browser doctor` exits `0`.
- `flint shard setup ab` reports the local layer as `completed`, and `ab-profile-config.md` carries a valid `ab-default-mode`.
- `flint shard ab profiles` runs and lists profiles/sessions; `flint shard ab open throwaway https://example.com` brings up a session and `flint shard ab stop throwaway` closes it.

To reconfigure later, edit `ab-profile-config.md` directly (no reinstall needed). Use `flint shard setup ab --reset` only to re-run setup from scratch.
