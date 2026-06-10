---
description: "agent-browser command groups, global flags, environment variables, and the skills/doctor subsystems"
---

# Knowledge: Agent Browser CLI Reference

A map of the `agent-browser` command surface and the flags/env vars that change global behavior. This is a reference index — the installed CLI is authoritative. For the exact, version-matched listing of every command and flag, run:

```bash
agent-browser skills get core --full
```

The everyday usage patterns (the snapshot/ref loop, login, extraction, etc.) live in [[dev-knw-ab-core]]. Domain-specific commands (Electron `connect`, providers) are in [[dev-knw-ab-specialized]].

## Command Groups

| Group | Commands | Purpose |
|-------|----------|---------|
| Lifecycle | `open <url>`, `close` (`--all`), `connect <port>`, `install`, `upgrade` | Open/close pages, attach to a running Chromium, install the browser runtime |
| Read | `snapshot` (`-i -u -c -d N -s <sel> --json`), `get <text\|html\|attr\|value\|title\|url\|count>` | Inspect the page |
| Interact | `click`, `dblclick`, `hover`, `focus`, `fill`, `type`, `press`, `check`/`uncheck`, `select`, `upload`, `scroll`, `scrollintoview`, `drag` | Drive elements (by `@eN` ref or selector) |
| Locate | `find <role\|text\|label\|placeholder\|testid\|first\|nth> <target> <action>` | Semantic locators without a prior snapshot |
| Wait | `wait @ref`, `wait <ms>`, `wait --text`, `wait --url`, `wait --load <state>`, `wait --fn` | Synchronize with page changes |
| Capture | `screenshot` (`--full --annotate --json`), `record start\|stop` | Images and video |
| Tabs | `tab`, `tab new <url>`, `tab <id>`, `tab close <id>` | Multiple pages with stable tabIds |
| Keyboard | `keyboard type`, `keyboard inserttext` | Raw input that bypasses element key handling |
| Frames | `frame @ref`, `frame main` | Scope into / out of iframes |
| Dialogs | `dialog status\|accept\|dismiss` | Handle `confirm`/`prompt` |
| Auth & state | `auth save\|login`, `state save\|load`, `cookies set --curl <file>` | Credentials and persisted sessions |
| Eval | `eval "<expr>"`, `eval --stdin`, `eval -b <base64>` | Run arbitrary JavaScript in the page |
| Network | `network route <glob> --body\|--abort`, `network requests`, `network har start\|stop` | Mock and inspect traffic |
| React | `react tree\|inspect\|renders\|suspense`, `vitals`, `pushstate` | React introspection + Web Vitals |
| Diagnostics | `doctor` (`--offline --quick --fix --json`), `console`, `errors` | Health checks and page logs |
| Skills | `skills list`, `skills get <name>` (`--full`) | Load version-matched skill content from the CLI |

## Global Flags

These apply across commands and change how the browser is launched or connected:

```bash
--session <name>        # isolated browser session (own cookies, tabs, refs)
--json                  # JSON output (machine parsing)
--headed                # show the window (default is headless)
--auto-connect          # connect to an already-running Chrome
--cdp <port>            # connect to a specific CDP port
--profile <name|path>   # use a Chrome profile (login state survives)
--headers <json>        # HTTP headers scoped to the URL's origin
--proxy <url>           # proxy server
--state <path>          # load saved auth state from JSON
--session-name <name>   # auto-save/restore session state by name
--color-scheme <light|dark>   # force a color scheme
--enable react-devtools # install the React DevTools hook at launch
-p, --provider <name>   # browser provider (e.g. agentcore) — see knw-ab-specialized
```

## Environment Variables

| Variable | Effect |
|----------|--------|
| `AGENT_BROWSER_SESSION` | Default `--session` for the current shell |
| `AGENT_BROWSER_SESSION_NAME` | Default `--session-name` (auto-save/restore) |
| `AGENT_BROWSER_COLOR_SCHEME` | Default color scheme (`light`/`dark`) |
| `AGENT_BROWSER_PROVIDER` | Default provider (avoids passing `-p` each call) |
| `AGENT_BROWSER_SNAPSHOT_ID` | Vercel Sandbox snapshot for fast startup (see [[dev-knw-ab-specialized]]) |

## The `skills` Subsystem

The CLI serves its own documentation so instructions never go stale between releases:

```bash
agent-browser skills list                 # all skills on the installed version
agent-browser skills get core             # core workflows, patterns, troubleshooting
agent-browser skills get core --full      # + full command reference and templates
agent-browser skills get <electron|slack|dogfood|vercel-sandbox|agentcore>
```

When the content in this shard and the CLI disagree, the CLI wins — it matches the binary actually installed on this machine.

## `doctor` — First Stop for Any Failure

If a command fails unexpectedly (unknown command, failed connection, stale daemon, version mismatch after upgrade, missing Chrome), run `doctor` before anything else:

```bash
agent-browser doctor                     # full diagnosis (env, Chrome, daemons, config, providers, network, launch test)
agent-browser doctor --offline --quick   # fast, local-only
agent-browser doctor --fix               # destructive repairs (reinstall Chrome, purge stale state)
agent-browser doctor --json              # structured output
```

`doctor` auto-cleans stale socket/pid/version sidecar files on every run. Exit code is `0` if all checks pass (warnings OK), `1` if any fail.

