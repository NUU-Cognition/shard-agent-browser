---
description: "Specialized agent-browser domains — Electron desktop apps, Slack, Vercel Sandbox microVMs, and AWS Bedrock AgentCore cloud browsers"
---

# Knowledge: Agent Browser Specialized Domains

`agent-browser`'s core snapshot-and-ref loop ([[dev-knw-ab-core]]) applies unchanged to several non-web targets. This file summarizes the four specialized domains. Each maps to a live CLI skill — when you need current, version-matched detail, load it with `agent-browser skills get <name>`.

| Domain | Live skill | When |
|--------|-----------|------|
| Electron desktop apps | `skills get electron` | Automating VS Code, Slack desktop, Discord, Figma, Notion, Spotify, etc. |
| Slack | `skills get slack` | Checking unreads, navigating, searching, extracting from a Slack workspace |
| Vercel Sandbox | `skills get vercel-sandbox` | Running agent-browser + Chrome inside ephemeral Vercel microVMs |
| AWS AgentCore | `skills get agentcore` | Browser sessions hosted on AWS Bedrock AgentCore |

## Electron Desktop Apps

Electron apps are Chromium under the hood and expose a CDP port, so the same workflow applies. **Launch with remote debugging, connect, then snapshot/interact.**

```bash
# macOS — quit the app first if already running, then relaunch with the flag
open -a "Slack" --args --remote-debugging-port=9222
agent-browser connect 9222      # subsequent commands target the app (no --cdp needed)
agent-browser snapshot -i
agent-browser click @e5
agent-browser screenshot slack-desktop.png
```

- Other apps differ only in port: VS Code `9223`, Discord `9224`, Figma `9225`, Notion `9226`, Spotify `9227` (any port is fine — keep them distinct).
- Linux: `slack --remote-debugging-port=9222`. Windows: run the app `.exe` with the same flag.
- **The `--remote-debugging-port` flag must be present at launch** — if the app is already running, quit and relaunch.
- Electron apps often have multiple windows/webviews: `agent-browser tab` lists targets (pages and `webview` type), `tab <n>` or `tab --url "*settings*"` switches.
- Color scheme via CDP defaults to light: `agent-browser --color-scheme dark snapshot -i` (or `AGENT_BROWSER_COLOR_SCHEME=dark`).
- Run several apps at once with named sessions: `--session slack connect 9222`, `--session vscode connect 9223`.
- Troubleshooting: "connection refused" → relaunch with the flag and `sleep 3` before connecting; missing elements → wrong webview, use `tab`; can't type → `keyboard inserttext`.

## Slack

Browser automation against the Slack web app or desktop client (no Slack API, OAuth, or bot tokens). Connect to an already-open Slack on its CDP port, or open the web app:

```bash
agent-browser connect 9222                  # existing desktop session (faster)
# or
agent-browser open https://app.slack.com
agent-browser snapshot -i
```

Common tasks — check unreads (Activity tab, "More unreads" in the sidebar), navigate to a channel (click its treeitem), search (search button → fill → Enter), extract (`snapshot --json` and parse treeitems/listitems). Re-snapshot after every navigation; pace rapid interactions; Slack may rate-limit. Workspace-scoped only — no cross-workspace automation. Load `agent-browser skills get slack` for the full sidebar map, ref hints, and an end-to-end unread-check script.

## Vercel Sandbox microVMs

Run `agent-browser` + headless Chrome inside ephemeral Vercel Sandbox microVMs — useful for browser automation from any Vercel-deployed framework (Next.js, SvelteKit, Nuxt, Remix, Astro) without binary-size limits. Pattern:

1. `pnpm add @vercel/sandbox`.
2. Create a sandbox (`Sandbox.create`), install Chromium system deps via `dnf`, `npm i -g agent-browser`, then `npx agent-browser install` — or boot from a pre-built **sandbox snapshot** for sub-second startup.
3. Run `agent-browser` commands via `sandbox.runCommand(...)`; the VM persists between commands so multi-step flows work.
4. `sandbox.stop()` when done (use a `finally`).

A **sandbox snapshot** (Vercel infra image with deps + agent-browser + Chromium pre-installed) is set via `AGENT_BROWSER_SNAPSHOT_ID` and is strongly recommended for production — without it each run reinstalls deps (~30s). On Vercel, the Sandbox SDK authenticates via OIDC automatically; for local dev set `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`. Combine with Vercel Cron for scheduled browser jobs. Note: this "sandbox snapshot" is unrelated to agent-browser's accessibility `snapshot` command. Load `agent-browser skills get vercel-sandbox` for the full `withBrowser` helper and snapshot-creation script.

## AWS Bedrock AgentCore Cloud Browsers

Run sessions on AWS-hosted cloud browsers. Every standard command works identically — only where the browser runs changes:

```bash
agent-browser -p agentcore open https://example.com
agent-browser snapshot -i
agent-browser click @e1
agent-browser close
```

- Credentials resolve automatically from env (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `AWS_SESSION_TOKEN`) or the AWS CLI (`aws configure export-credentials`, supporting SSO/IAM roles/named profiles).
- Key env vars: `AGENTCORE_REGION` (default `us-east-1`), `AGENTCORE_BROWSER_ID`, `AGENTCORE_PROFILE_ID` (persist cookies/localStorage across sessions), `AGENTCORE_SESSION_TIMEOUT` (default 3600s), `AWS_PROFILE`.
- Set `AGENT_BROWSER_PROVIDER=agentcore` to avoid passing `-p agentcore` each call.
- On session start, a **Live View URL** is printed to stderr — open it in the AWS Console to watch the session live.
- Common issues: "Failed to run aws CLI" → install AWS CLI or set keys directly; expired SSO → `aws sso login`; long tasks → raise `AGENTCORE_SESSION_TIMEOUT`.
