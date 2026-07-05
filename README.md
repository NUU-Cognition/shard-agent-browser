# Agent Browser

Drive a real browser from inside a Flint using the [`agent-browser`](https://github.com/vercel-labs/agent-browser) CLI — fast native (Rust) automation over the Chrome DevTools Protocol. Agents read pages as compact accessibility-tree snapshots with `@eN` element refs instead of parsing HTML.

**Shorthand:** `ab` · **Load:** `flint shard start ab`

## The Model

Browsers are shared machine-level resources; Orbh sessions claim one and drive it. One script covers listing and assignment; everything else is knowledge about the CLI.

```bash
flint shard ab browser list                # open browsers + which Orbh session holds each
flint shard ab browser assign <name>       # claim a browser for this session (or cdp:<port>)
flint shard ab browser release             # drop the claim
agent-browser --session <name> ...         # drive it — snapshot -i, click @eN, re-snapshot
```

Assignments live on the Orbh session interface (`browser` key) — no state files.

## What's Here

| File | Purpose |
|------|---------|
| `dev-init-ab.md` | Entry point — the model, the browser script, safety |
| `dev-setup-ab.md` | Per-machine setup: install the CLI + runtime |
| `knowledge/dev-knw-ab-cli.md` | The durable usage model — snapshot-and-ref loop, waits, sessions, CDP attach, troubleshooting |
| `scripts/dev-browser.js` | `flint shard ab browser <list\|assign\|release>` |

## Design

The shard is deliberately thin. The `agent-browser` CLI serves its own live, version-matched documentation (`agent-browser skills get <name>`) — this shard keeps only what doesn't go stale (the interaction loop, the session model) plus the workspace convention for sharing browsers between Orbh sessions. When the shard and the CLI disagree, the CLI wins.

## Source

The `agent-browser` CLI is published by [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser).
