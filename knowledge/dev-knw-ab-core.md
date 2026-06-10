---
description: "Core agent-browser usage — the snapshot/ref loop, navigating, interacting, waiting, extracting, screenshots, tabs, sessions, and troubleshooting"
---

# Knowledge: Agent Browser Core

The everyday usage model for the `agent-browser` CLI. Covers reading pages, interacting with elements, waiting, extracting data, screenshots, tabs, and multi-session work — everything a normal web task needs. For the exhaustive command/flag listing see [[dev-knw-ab-cli]]; for non-web domains (Electron, Slack, cloud providers) see [[dev-knw-ab-specialized]].

`agent-browser` talks to Chrome/Chromium over the Chrome DevTools Protocol — no Playwright or Puppeteer. It renders pages as accessibility-tree snapshots with compact `@eN` refs so an agent interacts in ~200–400 tokens instead of parsing HTML. The browser stays running across commands, so a sequence of commands behaves like one session until you `close`.

## The Core Loop

```bash
agent-browser open <url>        # 1. Open a page
agent-browser snapshot -i       # 2. See interactive elements (refs @e1, @e2, ...)
agent-browser click @e3         # 3. Act on a ref from the snapshot
agent-browser snapshot -i       # 4. Re-snapshot after any page change
```

Refs (`@e1`, `@e2`, …) are assigned **fresh on every snapshot** and become stale the moment the page changes — after navigating clicks, form submits, dynamic re-renders, or dialog opens. **Always re-snapshot before your next ref interaction.** This is the single most important rule.

## Reading a Page

```bash
agent-browser snapshot                # full tree (verbose)
agent-browser snapshot -i             # interactive elements only (preferred)
agent-browser snapshot -i -u          # include href urls on links
agent-browser snapshot -i -c          # compact (drop empty structural nodes)
agent-browser snapshot -i -d 3        # cap depth at 3 levels
agent-browser snapshot -s "#main"     # scope to a CSS selector
agent-browser snapshot -i --json      # machine-readable output
```

Snapshot output looks like:

```
Page: Example - Log in
URL: https://example.com/login

@e1 [heading] "Log in"
@e2 [form]
  @e3 [input type="email"] placeholder="Email"
  @e4 [input type="password"] placeholder="Password"
  @e5 [button type="submit"] "Continue"
  @e6 [link] "Forgot password?"
```

Use `snapshot -i` to find clickable/fillable elements; use `snapshot` (no flag) to read page content. For unstructured reads without refs:

```bash
agent-browser get text @e1        # visible text of an element
agent-browser get html @e1        # innerHTML
agent-browser get attr @e1 href   # any attribute
agent-browser get value @e1       # input value
agent-browser get title           # page title
agent-browser get url             # current URL
agent-browser get count ".item"   # count matching elements
```

## Interacting

```bash
agent-browser click @e1                 # click
agent-browser click @e1 --new-tab       # open link in a new tab instead of navigating
agent-browser dblclick @e1              # double-click
agent-browser hover @e1                 # hover
agent-browser focus @e1                 # focus (useful before keyboard input)
agent-browser fill @e2 "hello"          # clear then type
agent-browser type @e2 " world"         # type without clearing (char-by-char)
agent-browser press Enter               # press a key at current focus
agent-browser press Control+a           # key combination
agent-browser check @e3 / uncheck @e3   # checkbox
agent-browser select @e4 "value"        # select dropdown option ("a" "b" for multiple)
agent-browser upload @e5 file.pdf       # upload file(s)
agent-browser scroll down 500           # scroll page (up/down/left/right)
agent-browser scrollintoview @e1        # scroll element into view
agent-browser drag @e1 @e2              # drag and drop
```

### When refs don't work or you'd rather not snapshot

Semantic locators (no prior snapshot needed):

```bash
agent-browser find role button click --name "Submit"
agent-browser find text "Sign In" click          # add --exact for exact match
agent-browser find label "Email" fill "user@test.com"
agent-browser find placeholder "Search" type "query"
agent-browser find testid "submit-btn" click
agent-browser find first ".card" click
agent-browser find nth 2 ".card" hover
```

Or a raw CSS selector as a fallback:

```bash
agent-browser click "#submit"
agent-browser fill "input[name=email]" "user@test.com"
```

**Rule of thumb:** snapshot + `@eN` refs are fastest and most reliable. `find role/text/label` is next best. Raw CSS is the last resort.

## Waiting (read this)

Agents fail more often from bad waits than bad selectors. After any page-changing action, pick the right wait:

```bash
agent-browser wait @e1                      # until an element appears
agent-browser wait --text "Success"         # until text appears on the page
agent-browser wait --url "**/dashboard"     # until URL matches a glob
agent-browser wait --load networkidle       # until network idle (SPA navigation catch-all)
agent-browser wait --load domcontentloaded  # until DOMContentLoaded
agent-browser wait --fn "window.app.ready"  # until a JS condition is true
agent-browser wait 2000                     # dumb millisecond wait (last resort)
```

Avoid bare `wait 2000` except when debugging — it makes scripts slow and flaky. Timeouts default to ~25 seconds.

## Common Workflows

### Log in

```bash
agent-browser open https://app.example.com/login
agent-browser snapshot -i
# pick the email/password/submit refs, then:
agent-browser fill @e3 "user@example.com"
agent-browser fill @e4 "hunter2"
agent-browser click @e5
agent-browser wait --url "**/dashboard"
agent-browser snapshot -i
```

Credentials in shell history are a leak. For anything sensitive, use the auth vault:

```bash
agent-browser auth save my-app --url https://app.example.com/login \
  --username user@example.com --password-stdin   # type password, Ctrl+D
agent-browser auth login my-app                  # fills + clicks, waits for the form
```

### Persist a session across runs

```bash
agent-browser state save ./auth.json                         # save cookies + localStorage
agent-browser --state ./auth.json open https://app.example.com  # later runs start logged in
```

Or auto-save/restore by name:

```bash
AGENT_BROWSER_SESSION_NAME=my-app agent-browser open https://app.example.com
```

### Extract data

```bash
agent-browser snapshot -i --json > page.json     # structured snapshot (best for reasoning)
agent-browser get text @e5                       # targeted extraction
agent-browser get attr @e10 href

# Arbitrary shape via JavaScript — prefer heredoc for anything with quotes:
cat <<'EOF' | agent-browser eval --stdin
const rows = document.querySelectorAll("table tbody tr");
Array.from(rows).map(r => ({ name: r.cells[0].innerText, price: r.cells[1].innerText }));
EOF
```

Inline `agent-browser eval "..."` works only for simple expressions; use `eval --stdin` (heredoc) or `eval -b <base64>` for anything with quotes or special characters.

### Screenshot

```bash
agent-browser screenshot                  # temp path, printed on stdout
agent-browser screenshot page.png         # specific path
agent-browser screenshot --full full.png  # full scroll height
agent-browser screenshot --annotate map.png   # numbered labels [N] keyed to @eN refs
```

`--annotate` is designed for multimodal models: each label `[N]` maps to ref `@eN`.

### Tabs

```bash
agent-browser tab                       # list open tabs (stable tabId)
agent-browser tab new https://docs...   # open a new tab and switch to it
agent-browser tab t2                    # switch to tab t2
agent-browser tab close t2              # close tab t2
```

Stable `tabId`s point at the same tab across commands even as others open/close. After switching, refs from a prior snapshot on another tab no longer apply — re-snapshot.

### Multiple browsers in parallel

Each `--session <name>` is an isolated browser with its own cookies, tabs, and refs:

```bash
agent-browser --session a open https://app.example.com
agent-browser --session b open https://app.example.com
agent-browser --session a fill @e1 "alice@test.com"
agent-browser --session b fill @e1 "bob@test.com"
```

`AGENT_BROWSER_SESSION=myapp` sets the default session for the current shell.

### Iframes and dialogs

Iframes are auto-inlined into the snapshot — their refs work transparently. To scope into one: `agent-browser frame @e3`, then `agent-browser frame main` to return. `alert`/`beforeunload` dialogs are auto-accepted so agents never block; for `confirm`/`prompt` use `agent-browser dialog status|accept|dismiss`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Ref not found" / "Element not found: @eN" | Page changed since the snapshot — re-run `snapshot -i` and use the new refs. |
| Element in the DOM but not in the snapshot | Off-screen or not yet rendered — `scroll down 1000` then re-snapshot, or `wait --text "..."`. |
| Click does nothing | An overlay/modal/cookie banner is swallowing it — snapshot, dismiss it, re-snapshot. |
| Fill/type doesn't register | Custom input component intercepting keys — `focus @e1` then `keyboard inserttext "text"`, or `keyboard type "text"`. |
| Complex JS won't run inline | Use `eval --stdin` with a heredoc. |
| Auth expires mid-run | Use `--session-name <name>` or `state save`/`state load` so the session survives restarts. |
| Anything weird (unknown command, won't connect, stale daemon, version mismatch) | Run `agent-browser doctor` first; `doctor --fix` for destructive repairs. |

## React / Web Vitals (built-in)

Works on any React app when launched with `--enable react-devtools`:

```bash
agent-browser open --enable react-devtools http://localhost:3000
agent-browser react tree                 # component tree
agent-browser react inspect <fiberId>    # props, hooks, state, source
agent-browser react renders start|stop   # re-render profiling
agent-browser vitals [url]               # LCP/CLS/TTFB/FCP/INP + hydration (any site)
agent-browser pushstate <url>            # SPA navigation (auto-detects Next router)
```

`vitals` and `pushstate` work on any site; the other `react …` commands require the DevTools hook (`--enable react-devtools`) at launch.
