---
description: "Self-hosted persistent browsers — the two-door model, nbrowser, tab discipline in a shared browser, and the await handoff protocol"
---

# Knowledge: Self-Hosted Persistent Browsers

[[dev-knw-ab-remote]] covers browsers you *rent* — created per task, wearing a login replayed from a state file, and destroyed afterwards. This file covers the other shape: a browser the workspace **hosts and never stops**, whose login lives in a real Chrome profile on disk.

The practical difference is that a login stops being something you capture and becomes something you simply *have*.

## The Two-Door Model

A persistent browser exposes two doors, and they open onto **different layers of the same browser**:

```
   AGENT                                          HUMAN
   agent-browser                                  browser tab (noVNC)
       │ CDP over HTTP/WS                             │ WebSocket
       ▼                                              ▼
   socat ──► Chromium's CDP port                  websockify ──► x11vnc
       │     (loopback only, forced)                  │ XTEST inject
       ▼                                              ▼
   ┌────────────────────────────────────────────────────────────┐
   │  CHROMIUM  ◄── renders to ──►  Xvfb (virtual display)       │
   └────────────────────────────────────────────────────────────┘
                              │
                    profile directory on disk
```

The agent enters at Chromium's **protocol** layer. The human enters **below** Chromium, at the X server, as ordinary OS input events — Chromium cannot distinguish them from a real keyboard.

**The consequence that matters: a human can click and type while an agent holds its CDP connection.** No detaching, no handover. This was verified by observation — keystrokes injected through the full viewer chain landed in a page while an agent held CDP and read the result back.

Contrast a hosted service whose live view is itself a CDP screencast: there both parties contend for the same protocol, and the view goes read-only whenever automation is attached. That is a property of *that* design, not of remote browsers generally.

## What a Persistent Browser Removes

Every one of these is a hazard [[dev-knw-ab-remote]] has to manage, and none of them exists here:

| Replay hazard | Under a persistent browser |
|---|---|
| Provider profiles save but do not restore | Not involved — it is a real Chrome profile |
| Capture → save → replay → copy the state file | No capture step at all |
| Rotating egress IP gets a replayed session revoked | One fixed IP, permanently |
| Captures were all-or-nothing across sites | Nothing is captured |
| The live view refuses input while CDP is attached | Input enters below CDP |
| Session cookies cannot survive save/restore | The process never stops, so the session stays warm |

What it adds instead is a host you must keep alive, and **concurrency contention** — see Tab Discipline.

## nbrowser

`nbrowser` is the tool that packages this: one container per identity, a real profile on a mounted volume, and a daemon that owns both container lifecycle and the human handoff.

```bash
nbrowser ls                            # identities and container state
nbrowser cdp <id>                      # CDP URL   → give to an AGENT
nbrowser view <id>                     # viewer URL → give to a HUMAN
nbrowser await <id> --reason "…"       # block until a human resolves it
nbrowser wait <token>                  # re-attach to a request if your process died
nbrowser done <id>                     # resolve from the CLI
```

All of these work from anywhere on the tailnet with `--host <addr>` — the address comes from the `(Browser)` artifact. Only host-admin verbs (`create`, `up`, `down`, …) must run on the host itself.

From the shard's point of view nothing else changes: `nbrowser cdp <id>` yields a CDP URL, and every agent-browser verb works against it unchanged.

```bash
agent-browser --session <id> connect "$(nbrowser cdp <id>)"
flint shard ab browser assign <id>
```

**Never hand a human the raw viewer port.** Hand them a daemon URL (`view` or the one `await` prints). A bare screen with no way to signal "done" looks broken, and they will sit there.

## Tab Discipline — The Real Cost of Sharing

A shared browser means an agent's context can be taken from underneath it. Measured behaviour:

| Human action | Effect on an attached agent |
|---|---|
| **Switches** between existing tabs | **Nothing.** The agent stays where it was |
| **Opens a new tab or window** | **The agent is dragged onto it, silently** |

The second is the dangerous one, because there is no error. The agent simply begins reading — and would begin clicking — on a page it did not choose. An agent taking an irreversible action on a human's tab is the actual risk, not a null reference.

**Windows do not isolate.** `agent-browser` manages tabs *in the current window* and has no window concept; a separate OS window is just another target in one flat list.

The discipline:

```bash
agent-browser --session <id> tab new --label "s-${ORBH_SESSION_ID%%-*}" <url>   # claim your own
agent-browser --session <id> tab "s-${ORBH_SESSION_ID%%-*}"                     # re-assert before acting
```

**The label is your Orbh session short id** (`s-` plus the first segment, e.g. `s-c875184e`) — labels must be identifier-safe, and this one doubles as an ownership registry: `tab list` shows whose tab is whose, and an agent that needs something from a tab's owner can resolve the short id (`flint orbh list`) and message that session (`flint orbh message send <session-id> "…"`). Never act on a tab carrying another session's label. Stable ids (`t1`, `t2`) are never reused within a session, so they also work as references.

**Close every tab you labelled when your task ends.** The browser never restarts, so an abandoned tab sits there indefinitely as a mystery for the next agent and clutter on the human's screen. Closing your own tabs — and only your own — is part of finishing.

## The Await Handoff Protocol

When an agent hits a login wall it must not attempt the sign-in. It hands over:

```
agent                        daemon                        human
  │ nbrowser await <id> ────► creates a record
  │ ◄──────── handoff URL ───┤
  │                          ├── notify ──────────────────► opens URL
  │ ▓ BLOCKED                │                              signs in
  │ ▓ long-poll              │ ◄──── POST resolve ─────────┤ clicks Done
  │ ◄──── returns ───────────┤
  │ resumes
```

The human page is a toolbar above an iframe of the viewer, so signing in and signalling completion happen in one tab. Every trigger — the Done button, `nbrowser done`, a chat button, the expiry sweep — is a client of the same resolve endpoint, so new trigger surfaces can be added without touching the agent side.

**`await` is also a mutual-exclusion protocol, and that is what makes tab contention manageable.** While a request is pending the human owns the browser and agents stand off; when it resolves, agents own it again and re-assert their tab. The hazard only exists when both drive at once, and the protocol prevents exactly that.

**"Done" is a claim, not proof.** It means *"the human says they are finished, try again now"* — never *"you are authenticated"*. The human may have signed into two of three sites, or abandoned a 2FA prompt. Verify the only way that has ever worked: **does the thing you came to do actually work?** Never enumerate per-site markers; the site you are using is the test.

## Measured Gotchas

Each of these was observed, not inferred. Do not re-litigate them without new evidence.

- **Chromium will not publish its CDP port from a container.** Since M113, `--remote-debugging-address=0.0.0.0` is forced back to `127.0.0.1` ([chromium issue 41487252](https://issues.chromium.org/issues/41487252), WontFix). A `socat` shim is the standard workaround, and `nbrowser`'s image ships one.
- **Chrome rejects hostname `Host` headers on CDP.** `100.72.71.62:9222` works; `box.tailnet.ts.net:9222` returns `Host header is specified and is not an IP address or localhost`. **Always record a persistent browser's CDP address as an IP.**
- **Cookies flush to disk on a ~30s timer.** Measured: absent at 0/10/20s, present at 30s. Stop a container within 30s of a login and that login is gone. Everything else (localStorage) persists sooner.
- **A stale `SingletonLock` blocks startup after a reboot.** Chromium locks a profile by symlinking `<hostname>-<pid>`; a recreated container has a new hostname, so Chromium reads it as "open on another computer" and refuses to start — silently, showing an empty screen. This fires on the *first reboot*, when the box is meant to come back unattended. The start script clears it; one container per identity makes that safe.
- **A container restart logs Google out — a restart is a re-login event.** Measured 2026-08-02 on a freshly signed-in identity: after a `down`/`up` cycle the profile came back intact (country-domain `SID` cookies on disk with year-plus expiries), but `.google.com` held only tracking cookies, `accounts.google.com` had no `LSID`, and Gmail fell through the account chooser to a password challenge. Likely Google's device-bound/rotating session credentials, not a profile defect. Consequence: the persistence promise is **the browser never stops**, not that it survives stopping — never restart a persistent browser to "fix" something; open a handoff instead. Sites on plain persistent cookies do survive restarts; Shibboleth-style SSO (session cookies) never does.
- **One identity is one browser.** Two live Chromiums cannot share a profile directory, so concurrency within an identity is serialised. Parallelism means forking the profile into a second identity, which then drifts.
- **`agent-browser download` strands files inside a remote browser.** It tells the browser to download to a path on the *agent's* machine; the browser faithfully recreates that path in its own filesystem and the verb reports "file not found" (measured — the file was found inside the container at the mirrored path). Against a persistent browser: click the element normally — a managed policy routes downloads to the host volume — then `nbrowser downloads <id>` / `nbrowser fetch <id> <file> --rm`. Per-connection `Browser.setDownloadBehavior` is not a fix either: it reverts when the setting connection drops (also measured).
- **There is no authentication on either door.** CDP is unrestricted control of a logged-in browser and the viewer has no password. The network boundary — a private overlay network, not the public internet — is the only thing protecting it. Never bind these ports to a public interface.

## Choosing Between Kinds

| Need | Kind |
|---|---|
| A login that just stays logged in | `persistent` |
| A browser a human can take over mid-task | `persistent` |
| Egress from a specific country | `replay` |
| Stealth against bot detection | `replay` |
| Many concurrent browsers wearing one login | `replay` |
| A browser with nothing valuable in it, for exploring | either — prefer a throwaway |

Default to `persistent` when the workspace can host it. Replay's entire cost is that the login is perishable; a standing browser's is not.
