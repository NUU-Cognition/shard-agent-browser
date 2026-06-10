---
description: "Browser modes (saved / throwaway / real), the profile-vs-keychain knobs, cookie encryption, the daemon option-cache gotcha, the dashboard, and the flint shard ab helper commands"
---

# Knowledge: Modes & the `flint shard ab` Helpers

How this shard launches browsers for testing, and the `flint shard ab` commands that drive it. Builds on [[dev-knw-ab-sessions]] (sessions/profiles) and [[dev-knw-ab-core]] (the drive loop). The headline: a "mode" is a preset over **two independent knobs**, and the shard ships helper scripts so you don't assemble them by hand.

## Two Knobs, Three Presets

Every browser launch answers two separate questions:

1. **Where do the logins come from? (the profile)** — an empty fresh dir, a managed dir you build up, or a clone of your real Chrome.
2. **How is it launched / how secure? (the keychain)** — agent-browser launches it with a *mock* keychain (weak, automation-friendly), or *you* launch real Chrome with the *real* OS keystore (macOS Keychain; Linux keyring / Windows DPAPI — see Platform Notes) and agent-browser attaches.

The shard exposes three friendly presets:

| Mode | Profile | Keychain / launch | Persists | Secure for real creds | Good for |
|------|---------|-------------------|----------|----------------------|----------|
| **`saved`** | managed dir (`~/.agent-browser/profiles/<name>`) | mock, agent-launched | ✅ | ⚠️ no | a repeatable test identity you log into once |
| **`throwaway`** | none (fresh each run) | mock, agent-launched | ❌ | ⚠️ no | clean-slate / anonymous automation |
| **`real`** | clone of your Default | **real Keychain**, you-launch + agent-attaches over CDP | ✅ | ✅ yes | acting as the real you (login-gated tasks) |

Each preset is also × `{headed | headless}` × `{warm | auto-close}`. The helpers default to **headed + warm** (you see the window; it doesn't auto-close).

## Why a Login Needs Both Knobs — Cookie Encryption in Three Layers

A "logged-in" cookie on disk is wrapped three times:

1. **The cookie** (`…/<profile>/Network/Cookies`, SQLite) is stored **encrypted**.
2. **Its encryption key** lives in `…/Local State` (JSON at the profile root) — itself encrypted.
3. **That key is sealed by the OS keystore** — on macOS the Keychain entry "Chrome Safe Storage", openable only by your logged-in user (Linux/Windows equivalents in Platform Notes below).

To read a cookie you need all three. Copying a profile brings layers 1 + 2 (`Default/` + `Local State`), but a copy is still sealed by layer 3 — and **what opens layer 3 is how Chrome is launched**:

| Launch | Keychain | Copied profile result |
|--------|----------|----------------------|
| agent-browser (`--use-mock-keychain --password-store=basic`) | fake/empty key | can't unseal → cookies are gibberish → **logged out** |
| you launch Chrome directly | the real "Chrome Safe Storage" key | unseals → cookies decrypt → **logged in** |

This is why `--profile Default` driven by agent-browser shows **signed-out** (mock keychain can't decrypt), while `real` mode — clone + *direct* real-Chrome launch + *attach* — shows you logged in. **Copied profile = where logins come from; real Keychain = whether they decrypt and are secure. Different axes.**

## Why `real` Clones Instead of Using Your Actual Default

Two hard blocks prevent attaching to your live everyday Chrome:

- **Singleton lock** — your running Chrome already holds the real `Default` dir; a second Chrome can't share it.
- **Chrome ≥ 136** — Chrome ignores `--remote-debugging-port` on the *Default* dir entirely (anti-cookie-theft).

A clone in a *different* dir sidesteps both. Trade-offs: it's a ~600 MB **snapshot** (drifts from your real profile over time — re-clone to refresh), and it's a **copy of sensitive cookies on disk**. Treat it carefully; remove with `rm -rf ~/.agent-browser/profiles/real-clone`. A lighter alternative for just-the-auth: attach once, then `agent-browser state save auth.json` (a few KB) and replay with `--state auth.json`.

> **Security:** `real` mode leaves `--remote-debugging-port` (default 9222) open on localhost while the session runs — any local process can drive that browser and read the real cookies inside it. Use on trusted machines only, and `flint shard ab stop real` (which leaves Chrome to be quit) or quit the cloned Chrome when done.

## Platform Notes

The two-knob model is the same everywhere; what differs is the OS keystore that seals layer 3 and the default paths (auto-detected by the helpers, overridable via `ab-chrome-bin` / `ab-chrome-root`):

| Platform | Layer-3 keystore | Notes |
|----------|-----------------|-------|
| macOS | Keychain ("Chrome Safe Storage") | The model described above, verbatim. |
| Linux | GNOME Keyring / KWallet (or `basic` plain-text on minimal installs) | Same clone-and-attach pattern; on `basic`-store systems even a mock-keychain launch may decrypt copied cookies. |
| Windows | DPAPI (bound to the Windows user) | A copied profile decrypts for the **same Windows user on the same machine** — the clone-and-attach pattern works; profile copying uses `robocopy` instead of `rsync`. |

## The Daemon Option-Cache Gotcha

Each `--session <name>` is a **persistent daemon** that **caches its launch options** (headed/headless, profile, mode). Re-running `open` against a live session with *different* options prints `--profile ignored: daemon already running` and keeps the old options. **To change headed/profile you must close first** (`flint shard ab stop <name>`, then `open … --fresh`). The helper `open` reuses a warm session as-is unless you pass `--fresh`.

## The Dashboard

agent-browser ships an observability dashboard at **http://localhost:4848** where every warm session appears live (engine, port, name) and can be streamed. It runs independently of sessions. Start it with `flint shard ab dashboard start`; it is not running by default.

## `flint shard ab` Commands

| Command | What it does |
|---------|--------------|
| `flint shard ab profiles` | list managed profiles, real Chrome profiles, active warm sessions, dashboard status |
| `flint shard ab open <mode> [url]` | open (or reattach to) a warm session in `saved`/`throwaway`/`real`; `--name`, `--headless`, `--fresh`, `--port`, `--clone <name\|path>` (real: target an alternate clone) |
| `flint shard ab login <saved\|real> [url]` | open a **headed** window to sign into (persists for saved/real); `--name` gives a saved identity its own profile dir |
| `flint shard ab clone [--name <dst>] [--source <profile>]` | clone your real Default (key + data, minus caches) into a managed dir for `real` mode; use with `open real --clone <dst>` |
| `flint shard ab dashboard <start\|stop\|status>` | manage the observability dashboard |
| `flint shard ab stop [name\|--all]` | close a warm session (or all) |

Defaults (mode, headed, paths) come from `Shards/(Shards) Local State/ab-profile-config.md`; the Chrome binary and profile root are auto-detected per platform when not set there. Sessions are named after their mode unless you pass `--name`; distinct `--name`s get distinct profile dirs in `saved` mode, so identities never share state. Programmatic resolution of a mode → flags is also described in [[dev-sk-ab-session]].

## Picking a Mode (rule of thumb)

- **Automating a public site / scraping / a clean run** → `throwaway`.
- **A test account you sign into and reuse** → `saved` (log in once via `flint shard ab login saved`).
- **A task that must act as *you* (your Gmail, your GitHub, anything login-gated)** → `real`.
