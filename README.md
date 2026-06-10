# Agent Browser

Drive a real browser, Electron desktop apps, and cloud browsers from inside a Flint using the [`agent-browser`](https://github.com/vercel-labs/agent-browser) CLI — fast native (Rust) automation over the Chrome DevTools Protocol. Agents read pages as compact accessibility-tree snapshots with `@eN` element refs instead of parsing HTML.

**Shorthand:** `ab` · **Load:** `flint shard start ab`

## What's Here

| File | Purpose |
|------|---------|
| `dev-init-ab.md` | Entry point — the snapshot-and-ref loop, the three modes, helper commands, safety, capability map |
| `dev-setup-ab.md` | Per-machine setup: install the CLI, then record the default mode in Local State |
| `knowledge/dev-knw-ab-core.md` | Core usage — navigate, interact, wait, extract, screenshot, tabs, troubleshooting (required reading) |
| `knowledge/dev-knw-ab-sessions.md` | Persistent sessions, profiles, auto-connect, saved state, cookie-carryover mechanics (required reading) |
| `knowledge/dev-knw-ab-modes.md` | The `saved`/`throwaway`/`real` modes, cookie encryption, the daemon cache, dashboard, `flint shard ab` commands (required reading) |
| `knowledge/dev-knw-ab-cli.md` | Command groups, global flags, env vars, the `skills` and `doctor` subsystems |
| `knowledge/dev-knw-ab-specialized.md` | Electron apps, Slack, Vercel Sandbox, AWS Bedrock AgentCore |
| `skills/dev-sk-ab-use_browser.md` | Complete a browser task from the prompt (defaults to the real user profile) |
| `skills/dev-sk-ab-session.md` | Resolve a mode → open/attach a warm session |
| `scripts/dev-*.js` | `flint shard ab` helpers — `profiles`, `open`, `login`, `clone`, `stop`, `dashboard` |
| `workflows/dev-wkfl-ab-manage_profiles.md` | Catch-all for browser ops — health, config, create/configure profiles |
| `workflows/dev-wkfl-ab-dogfood.md` | Exploratory testing → repro-first bug report |
| `templates/dev-tmp-ab-dogfood_report-v0.1.md` | Dogfood report structure |

## Modes & Commands

A launch is a preset over two knobs — *where logins come from* and *how secure / how it's launched*:

| Mode | Profile | Keychain | Use for |
|------|---------|----------|---------|
| `saved` | managed dir you build up | mock | a reusable test identity |
| `throwaway` | none (fresh) | mock | clean-slate / anonymous |
| `real` | clone of your Default | **real OS keystore** (macOS Keychain / Linux keyring / Windows DPAPI) | login-gated tasks as *you* |

```bash
flint shard ab profiles                            # profiles, sessions, dashboard status
flint shard ab open <saved|throwaway|real> [url]   # open/attach a warm session
flint shard ab login <saved|real> [url]            # headed window to sign into
flint shard ab clone                               # clone Default → real-clone (seed real logins)
flint shard ab dashboard start                     # http://localhost:4848
flint shard ab stop <name|--all>                   # close session(s)
```

## Design

The shard is **self-contained** — all durable usage content lives in its own knowledge/template files; it does not depend on the agent-browser source repo being present. Its one external dependency is the `agent-browser` CLI itself (installed per machine), which is also its own live, version-matched skill source: run `agent-browser skills get <name>` for authoritative current detail. When the shard and the CLI disagree, the CLI wins.

## Setup

`setup: local`, per machine. `setup-ab.md` installs the `agent-browser` CLI + runtime and records the default mode + paths in the gitignored companion file `Shards/(Shards) Local State/ab-profile-config.md` (the installer-managed marker `(Shard) Agent Browser (Local).md` only tracks `setup:`). `flint shard start ab` shows a SETUP REQUIRED banner until you finish and run `flint shard setup ab --complete`.

Works on macOS, Linux, and Windows — the helper scripts auto-detect the platform's Chrome binary and profile root (override via `ab-chrome-bin` / `ab-chrome-root`), and use `rsync` (macOS/Linux) or `robocopy` (Windows) for profile cloning.

## Source

Ported from the agent-browser skill set (`core`, `electron`, `slack`, `dogfood`, `vercel-sandbox`, `agentcore`) published by [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser).
