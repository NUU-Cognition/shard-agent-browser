---
description: "Replay browser identity — a login saved in a state file and rehydrated into fresh ephemeral browsers"
---

# Filename: Mesh/Types/Browsers/(Browser) NNN [Name].md

/* Creates a (Browser) artifact with `kind: replay`.
   Number with: flint helper type newnumber Browser

   WHAT THIS KIND IS. ONE reusable identity — a named login captured into a state
   file, which can be loaded into any number of fresh browsers from a provider.
   The browsers are disposable; the file is the identity.

   `kind: browser` is the former name for this kind and is still accepted. New
   artifacts should use `replay`, which says what actually happens.

   WHEN TO USE THIS KIND RATHER THAN `persistent`. Choose replay when you need
   browsers the workspace does not host: stealth against bot detection, an egress
   IP in a particular country, many concurrent browsers wearing one login, or a
   provider that simply is not yours to keep running. Otherwise prefer
   `persistent` — replay's whole cost is that the login is perishable, and a
   standing browser's is not.

   THE STABLE ID. A hosted browser's provider-side id changes on every launch, so
   it is never a durable handle. The stable handle is `stable-id` — OUR slug,
   chosen once and never changed. It names the state file and the agent-browser
   session, so the same identity is addressable across machines and months.

   WHAT DOES NOT GO HERE: live session state. A running browser is claimed on the
   Orbh session interface (`flint shard ab browser assign`), not written back here.

   SECRETS. A state file holds live session cookies. It is a credential of the
   same class as a password, and the current workspace stance commits it in plain
   text — say so under Security. */

```markdown
---
id: [generate-uuid4]
tags:
  - "#ab/browser"
kind: replay
stable-id: [our own slug — lowercase-hyphenated, chosen once, never changed]
status: [active (usable now)|untested (recorded but never driven end-to-end)|retired (superseded or revoked)]
provider: "[[wikilink to the (Browser) provider artifact]]"
state-file: [path to the saved state file, e.g. Media/Browsers/<stable-id>.state.json]
proxy-country: [egress setting used at capture — MUST match on replay. e.g. none, us]
orbh-sessions:
template: "[[tmp-ab-replay-v0.1]]"
authors:
  - "[[@Person Name]]"
---

# What This Is

[One paragraph: what this identity is logged into, whose account it is, and what
 an agent can do while wearing it. Follow with a table of covered sites and what
 each covers — an agent needs to know at a glance whether this identity is the
 one for the task.]

| Site | What it covers |
|------|----------------|
| [domain] | [what a signed-in agent can reach] |
| (continue) | |

# Credentials

| What | Value | Used as |
|------|-------|---------|
| Provider account | see [[provider artifact]] § Credentials | `[ENV_VAR]` |
| Saved session state | `[path]` | `agent-browser state load <path>` |

# Use

/* Literal and copy-pasteable, ending with the browser claimed. Load state BEFORE
   navigating — loading after a page is open leaves the first navigation
   unauthenticated. */

```bash
[obtain a browser from the provider → connect → state load → claim]
```

[State the egress requirement explicitly: capture and replay must egress from the
 same place or the site sees one session token arriving from unrelated IPs and
 revokes it. Name the exact setting.]

**Saved logins expire, and a signed-out page often looks fine.** Judge by whether
the thing you came to do works, not by whether a page loaded.

**If it is not signed in, stop and get a human.** Do not attempt the sign-in
yourself and do not carry on unauthenticated.

# Cleanup

/* The step that costs money goes FIRST — closing locally does not stop a remote
   browser, and it keeps billing. */

```bash
[stop the remote browser → close locally → release the claim → verify none active]
```

[Nothing needs saving on the way out: the state file is the source of truth and is
 only rewritten deliberately, in Refresh.]

# Duplication

[Whether this identity can be worn by several browsers at once, and how. A state
 file is just a file: copy it to fork the identity, load it into N browsers to run
 them in parallel. Note anything that makes concurrency unsafe — a site that
 invalidates old sessions on new login, or challenges many simultaneous sessions
 from different exit IPs.]

# Refresh

/* This section is why the artifact does not silently rot.

   Do NOT enumerate per-site verification markers here. They rot, and an agent
   judges authentication better by whether the task it came to do actually works.
   State the general rule instead. */

[How to re-capture, how staleness shows up, who can do the sign-in, and the
 last-captured date. Note whether captures are additive or replacing.]

# Limits and Gotchas

[Everything an agent would otherwise discover the hard way. Cover at minimum:
 egress-IP behaviour, which cookies survive and which cannot, and cost.]

- [limit, gotcha, or verified-broken behaviour]
- (continue)

# Security

[What this file and its state file expose, the current stance, and what must
 happen when the stance changes — a state file must be RE-CAPTURED, not merely
 relocated, because git history keeps the old cookies reachable and valid.]

# Log

- [YYYY-MM-DD]: [created, captured, verified, or broken — one line each]
- (continue)
```
