---
description: "Persistent browser identity — a standing self-hosted browser whose login lives in a real profile on disk"
---

# Filename: Mesh/Types/Browsers/(Browser) NNN [Name].md

/* Creates a (Browser) artifact with `kind: persistent`.
   Number with: flint helper type newnumber Browser

   WHAT THIS KIND IS. One browser that never stops. It runs on a host the
   workspace controls, its profile is a real Chrome profile directory on disk,
   and a login placed in it simply stays there. There is no capture, no state
   file, no replay, and no refresh cycle — a human signs in once, through the
   browser's own screen, and that is the whole lifecycle.

   HOW IT DIFFERS FROM `replay`, AND WHY IT IS A SEPARATE KIND. The Cleanup
   sections are OPPOSITES. A replay identity runs on rented browsers that MUST be
   stopped or they bill. A persistent identity is a shared standing browser that
   must NOT be stopped — closing it takes it away from everyone. An agent that
   skims the wrong runbook either burns money or kills a browser someone is
   using. Never merge these two kinds into one artifact.

   THE STABLE ID is the identity's name on its host and the agent-browser session
   name. It is chosen once and never changed.

   TWO DOORS. A persistent browser exposes CDP for agents and a screen for
   humans, and they reach different layers of the same browser — so a human can
   click and type WHILE an agent holds its CDP connection. Record both addresses.

   WHAT DOES NOT GO HERE: live session state, and the CDP port of a browser that
   moves. If the host's address changes, this artifact is what gets corrected.

   SECRETS. There is no authentication on either door. The network boundary is
   the only boundary — say which one under Security. */

```markdown
---
id: [generate-uuid4]
tags:
  - "#ab/browser"
kind: persistent
stable-id: [the identity's id on its host — lowercase-hyphenated, chosen once]
status: [active (usable now)|untested (recorded but never driven end-to-end)|retired (superseded or revoked)]
provider: "[[wikilink to the (Browser) provider artifact for the host]]"
cdp-url: [http://<address>:<port> — MUST be an IP, not a hostname. See Limits.]
view-url: [the human viewer URL served by the host]
host: [which machine this runs on, e.g. sparrow]
orbh-sessions:
template: "[[tmp-ab-persistent-v0.1]]"
authors:
  - "[[@Person Name]]"
---

# What This Is

[One paragraph: what this browser is logged into, whose account it is, which
 machine it runs on, and what an agent can do while driving it. Then the table of
 covered sites.]

| Site | What it covers |
|------|----------------|
| [domain] | [what a signed-in agent can reach] |
| (continue) | |

# Addresses

| Door | Address | For |
|------|---------|-----|
| CDP | `[http://<ip>:<port>]` | agents |
| Viewer | `[url]` | humans |

# Use

/* Short by design. There is nothing to launch and nothing to rehydrate. */

```bash
agent-browser --session [stable-id] connect "[cdp-url]"
flint shard ab browser assign [stable-id]
agent-browser --session [stable-id] tab new --label "s-${ORBH_SESSION_ID%%-*}" [url]
```

**Claim your own tab, labelled with your Orbh session short id, and re-assert it
before acting.** The label makes ownership visible: `tab list` shows whose tab
is whose, and the short id names the session to message if another agent needs
it. This browser is shared with a human and possibly other sessions. Switching
between existing tabs is harmless, but anyone opening a NEW tab drags an
attached agent onto it — silently. Never assume the current tab is still yours,
and never act on a tab labelled by another session.

**Downloads:** click the element normally (never `agent-browser download` — it
strands the file inside the remote browser), then:

```bash
nbrowser downloads [stable-id] --host [host-addr]                  # poll until complete
nbrowser fetch [stable-id] <file> -o <dest> --rm --host [host-addr]
```

**If a site is not signed in, hand it to a human** — do not attempt the sign-in
yourself:

```bash
[the await command for this host, with this stable-id]
```

That prints a URL, then blocks until a human resolves it. Send the URL, say which
sites you need, and wait.

# Cleanup

> [!warning] Do NOT stop, close, restart, or kill this browser — ever.
> It is a standing shared resource that was started once and stays up for good.
> A restart is a re-login event: it logs Google-class sites out even when the
> profile survives, so every stop costs a human sign-in. Never restart it to
> "fix" something — open a handoff instead. The only sanctioned stop is
> operator retirement.

```bash
agent-browser --session [stable-id] tab close "s-${ORBH_SESSION_ID%%-*}"   # every tab you labelled
flint shard ab browser release                                             # then release the claim
```

[Closing every tab carrying your session label is mandatory — the browser never
 restarts, so leftover tabs accumulate forever. Leave everything else alone.]

# Concurrency

[One identity is one browser: two live Chromiums cannot share a profile
 directory, so work on this identity is serialised. State what to do if two
 agents need it at once — usually: queue, or fork a second identity with a copy
 of the profile, accepting that the two then drift apart.]

# Re-login

/* Replaces the Refresh section a replay identity needs. There is no capture
   step; a human just signs in again through the viewer.

   Do NOT enumerate per-site verification markers here. They rot, and an agent
   judges authentication better by whether the task it came to do actually works. */

[How a human signs in: the await command, or the plain viewer URL if no agent is
 waiting. Note which sites are expected to expire quickly and why — SSO backed by
 short server-side sessions will keep expiring regardless of what is on disk.]

**Last signed in:** [YYYY-MM-DD] — [which sites]

# Limits and Gotchas

[Everything an agent would otherwise discover the hard way. Cover at minimum:]

- **Address this browser by IP, never a hostname.** Chrome rejects a CDP request
  whose `Host` header is not an IP or `localhost`.
- **A human opening a new tab or window steals an attached agent's context.**
  Windows do not isolate — a separate OS window is just another CDP target.
- **The host is a single point of failure.** If it sleeps, reboots, or drops off
  the network, this identity is unavailable. Say what the host is and who owns it.
- [further limits specific to this identity]
- (continue)

# Security

[There is no authentication on the CDP or viewer ports — anyone who can reach
 them has full interactive control of a logged-in account. Name the network
 boundary that is doing the work, and say what happens if it fails.]

# Log

- [YYYY-MM-DD]: [created, signed in, verified, or broken — one line each]
- (continue)
```
