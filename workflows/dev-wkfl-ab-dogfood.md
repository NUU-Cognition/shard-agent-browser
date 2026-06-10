---
description: "Systematically explore a web app to find bugs and UX issues, producing a repro-first report with screenshots and videos"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start ab` if you haven't already.

# Workflow: Dogfood

Systematically explore a web application like a real user, find issues, and produce a structured report where **every finding has reproduction evidence** — step-by-step screenshots and a repro video for interactive bugs, a single annotated screenshot for static ones. Uses the `agent-browser` CLI ([[dev-knw-ab-core]]) and the [[dev-tmp-ab-dogfood_report-v0.1]] report template.

# Input

- **Target URL** (required) — e.g. `vercel.com`, `http://localhost:3000`
- (Optional) **Scope** — focus area, e.g. "the billing page" (default: full app)
- (Optional) **Session name** — defaults to the slugified domain (e.g. `vercel-com`)
- (Optional) **Output directory** — defaults to `./dogfood-output/`
- (Optional) **Authentication** — account to sign in as (or rely on the configured persistent profile)

Use `agent-browser` directly, never `npx agent-browser` — the direct binary uses the fast Rust client.

# Actions

## Stage 1: Initialize & Authenticate

- Create the output structure: `mkdir -p {OUTPUT_DIR}/screenshots {OUTPUT_DIR}/videos`.
- Create the report file from [[dev-tmp-ab-dogfood_report-v0.1]] at `{OUTPUT_DIR}/report.md` and fill in the header fields (app name, date, URL, session, scope).
- **Open the session using this machine's configured profile defaults** — run [[dev-sk-ab-session]] (it reads Local State and resolves `--session`/`--profile`/`--auto-connect` per [[dev-knw-ab-sessions]]), then load the target. Persisted auth means you may already be logged in:
  ```bash
  # sk-ab-session resolves {RESOLVED_FLAGS} and {SESSION} from Local State
  agent-browser {RESOLVED_FLAGS} open {TARGET_URL}
  agent-browser --session {SESSION} wait --load networkidle
  ```
- **If still not authenticated and the app requires login (human checkpoint):** request credentials from the user — never assume or invent them. For OTP/email codes, ask the user and wait for their reply. After signing in, save state for reuse: `agent-browser --session {SESSION} state save {OUTPUT_DIR}/auth-state.json`.
- Once the app is open (and authenticated if required), progress to the next stage.

## Stage 2: Orient

- Take an initial annotated screenshot and snapshot to map the app:
  ```bash
  agent-browser --session {SESSION} screenshot --annotate {OUTPUT_DIR}/screenshots/initial.png
  agent-browser --session {SESSION} snapshot -i
  ```
- Identify the main navigation and list the sections to visit.
- Once you have a map of the app's surface, progress to the next stage.

## Stage 3: Explore & Document (single pass)

Explore and document together — when you find an issue, **stop and document it immediately** before moving on. Do not batch findings for the end; append each one so nothing is lost if interrupted.

- Work systematically: visit each top-level section; within each, test interactive elements (buttons, forms, dropdowns, modals); check edge cases (empty states, error handling, boundary inputs); try realistic end-to-end flows (create/edit/delete). Check the console periodically with `errors` and `console`.
- **Verify reproducibility before collecting evidence** — confirm the issue reproduces at least once. If it can't be reproduced consistently, it's not a valid issue.
- **Interactive / behavioral issues** — record a repro video and step screenshots at human pace:
  ```bash
  agent-browser --session {SESSION} record start {OUTPUT_DIR}/videos/issue-{NNN}-repro.webm
  # screenshot each step; sleep 1 between actions, sleep 2 before the final state
  agent-browser --session {SESSION} screenshot {OUTPUT_DIR}/screenshots/issue-{NNN}-step-1.png
  # ...perform actions, capturing each step...
  agent-browser --session {SESSION} screenshot --annotate {OUTPUT_DIR}/screenshots/issue-{NNN}-result.png
  agent-browser --session {SESSION} record stop
  ```
  Type with `type` (char-by-char) during recording so videos are watchable.
- **Static / visible-on-load issues** (typos, clipped text, misalignment, load-time console errors) — a single annotated screenshot is enough; set **Repro Video** to `N/A`, no video, no multi-step repro:
  ```bash
  agent-browser --session {SESSION} screenshot --annotate {OUTPUT_DIR}/screenshots/issue-{NNN}.png
  ```
- Append each issue to the report as you find it, incrementing the counter (ISSUE-001, ISSUE-002, …), with numbered repro steps that each reference their screenshot.
- Aim for **5–10 well-documented issues** — depth of evidence beats raw count. Never delete output files; never read the target app's source (test as a user, from what the browser shows). Once you've reached a solid set of findings, progress to the next stage.

## Stage 4: Wrap Up & Review

- Re-read the report and update the summary severity counts so they match the actual issues — every `### ISSUE-` block must be reflected in the totals.
- Close the session: `agent-browser --session {SESSION} close`.
- **Human checkpoint:** present the user a summary — total issues, breakdown by severity, and the most critical items — and the report path. Refine findings if the user requests changes.
- Once the user confirms, the workflow is complete.

# Output

- `{OUTPUT_DIR}/report.md` — repro-first report following [[dev-tmp-ab-dogfood_report-v0.1]]
- `{OUTPUT_DIR}/screenshots/` and `{OUTPUT_DIR}/videos/` — evidence for every finding
- `{OUTPUT_DIR}/auth-state.json` — saved session state (if authentication was used)
