---
description: "Persistent sessions, Chrome profiles, auto-connect, and saved state — how to make cookies/auth carry across runs, plus this shard's Local State defaults"
---

# Knowledge: Sessions, Profiles & Persistence

How `agent-browser` keeps a browser alive between commands and how to make cookies/auth **carry over across runs** — essential for testing, where you want to log in once and stay logged in. This shard stores a per-machine default for this in its **Local State** file (see [[#This Shard's Local State Defaults]]).

## Persistent Sessions (the daemon model)

Every `--session <name>` spawns a **persistent background daemon** — the browser process stays alive between CLI invocations until you `close` it. Sidecar files live under `~/.agent-browser/` (`session-<n>.sock`, `.pid`, `.engine`). The unnamed default session is `session-1`.

```bash
agent-browser --session flint open https://app.example.com   # spawns/raises the "flint" daemon
agent-browser --session flint snapshot -i                     # same live browser, no re-open
agent-browser --session flint click @e3
agent-browser session list                                    # list active sessions
agent-browser --session flint close                           # tear the daemon down
```

Pinning one stable session name (e.g. `flint`) across a test run means the browser persists — you are not relaunching Chrome on every command. `AGENT_BROWSER_SESSION=flint` sets the default for the shell.

**Session ≠ persisted auth.** A session daemon staying alive is not the same as state surviving a `close`/restart. For that you need a profile, a session-name, or a saved state file — below.

## Four Ways to Carry Auth Across Runs

| Mechanism | Flag | Carryover | Notes |
|-----------|------|-----------|-------|
| Dedicated persistent profile | `--profile <dir>` | ✅ reliable | **Recommended.** agent-browser owns the user-data-dir and launches Chromium itself; log in once, everything persists (cookies, IndexedDB, SW, cache). No port juggling. |
| Auto-connect to a debug Chrome | `--auto-connect` / `--cdp <port>` | ✅ live session | Attach to a Chrome you launched with a non-default `--user-data-dir` **and** `--remote-debugging-port`. Cannot use your real Default profile on Chrome ≥ 136 (see below). |
| Reuse a Chrome profile by name | `--profile Default` | ⚠️ unreliable | See the caveat below. |
| Named session / saved state | `--session-name <n>` / `--state <file>` | ✅ lightweight | Auto-saves or loads cookies+localStorage; no full profile. |

### Auto-connect (attach to a debug Chrome over CDP)

Drive a Chrome that's running with a DevTools port. **Critical restriction (verified live on Chrome 148):** modern Chrome (≥ v136) **silently ignores `--remote-debugging-port` when launched against the default profile directory** — a security mitigation so malware can't steal cookies from your everyday browser. Pointing the flag at your normal Chrome opens **no port at all**, so you cannot CDP-attach to your real Default profile.

The working pattern launches a **separate** Chrome with an explicit, non-default `--user-data-dir` *and* the port:

```bash
# 1. Launch a dedicated debug Chrome (its own user-data-dir → the port actually opens):
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --user-data-dir="$HOME/.agent-browser/chrome-debug" \
  --remote-debugging-port=9222 --no-first-run --no-default-browser-check
#    Linux:   google-chrome --user-data-dir=~/.agent-browser/chrome-debug --remote-debugging-port=9222
#    Windows: chrome.exe --user-data-dir=%USERPROFILE%\.agent-browser\chrome-debug --remote-debugging-port=9222

# 2. Attach and drive (log in once in that window; it persists in that dir):
agent-browser --session flint --auto-connect open https://app.example.com/dashboard
#    --auto-connect probes port 9222 only; for any other port use --cdp <port> or `connect <port>`.
```

So on modern Chrome "auto-connect" is really *attach to a dedicated debug instance you launched* — functionally a dedicated profile. To seed it with your **existing** Default logins one time, copy the (fully-closed) Default dir in first: `cp -R "$HOME/Library/Application Support/Google/Chrome/Default" "$HOME/.agent-browser/chrome-debug/Default"` — cookies decrypt because it's the same OS user/keychain.

Tip: snapshot the live auth into a reusable file once, then run headless from it:

```bash
agent-browser --auto-connect state save ./auth.json
agent-browser --state ./auth.json open https://app.example.com/dashboard
```

> **Security:** `--remote-debugging-port` exposes full browser control on localhost — any local process can read cookies and run JS. Use on trusted machines only and close the port when done.

### Dedicated persistent profile

A self-owned user-data-dir, isolated from your real Chrome. Log in once (headed), reused forever:

```bash
agent-browser --session flint --profile ~/.agent-browser/profiles/flint --headed open https://app.example.com/login
# ...log in once...
agent-browser --session flint --profile ~/.agent-browser/profiles/flint open https://app.example.com/dashboard   # already authed
```

`AGENT_BROWSER_PROFILE=<dir>` sets it via env. Use distinct dirs for distinct test users (`.../admin`, `.../viewer`).

### The `--profile Default` caveat (verified)

Pointing `--profile` at a real Chrome profile **name** (e.g. `Default`) to reuse your everyday logins is unreliable **while Chrome is running**: Chrome locks its cookie DB and OS-encrypts the values, so a separate Chromium opens the profile but sees a signed-out state. `agent-browser profiles` / `profiles --json` enumerates the real profiles, but for dependable carryover prefer **auto-connect** (drive the real Chrome) or a **dedicated profile dir** (own it). Reserve `--profile Default` for cases where Chrome is fully closed.

## Listing Real Chrome Profiles

```bash
agent-browser profiles          # human list
agent-browser profiles --json   # [{"directory":"Default","name":"Your Chrome"}, ...]
```

Drive any profile-picker prompt from the `--json` form.

## This Shard's Local State Defaults

Because browser setup is per-machine, the Agent Browser shard declares `setup: local`, and its config lives in the gitignored `Shards/(Shards) Local State/` folder — split across **two files**:

| File | Holds | Why |
|------|-------|-----|
| `(Shard) Agent Browser (Local).md` | the `setup:` marker (`required` → `completed`) | Installer-managed — it **regenerates this file** on every install/reinstall, preserving only `id`/`tags`/`setup`. Don't store config here; it gets wiped. |
| `ab-profile-config.md` | the durable `ab-*` browser config | A companion file the installer does **not** touch — survives reinstalls. This is the real config. |

[[dev-setup-ab]] writes this machine's browser defaults into `ab-profile-config.md` — `ab-default-mode`, `ab-headed`, `ab-cdp-port`, `ab-saved-path`, `ab-real-clone-path`, and (optional, auto-detected per platform when unset) `ab-chrome-bin` / `ab-chrome-root`. The `flint shard ab` helpers and [[dev-sk-ab-session]] read it to resolve a mode into the right flags. **The mode presets (`saved` / `throwaway` / `real`) and the full field reference live in [[dev-knw-ab-modes]]** — that is the authoritative config doc; this file covers the underlying session/profile mechanics those modes are built on.
