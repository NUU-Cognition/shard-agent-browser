---
description: "Browser provider — an account, host, or endpoint that browsers are obtained FROM"
---

# Filename: Mesh/Types/Browsers/(Browser) NNN [Name].md

/* Creates a (Browser) artifact with `kind: provider`.
   Number with: flint helper type newnumber Browser

   WHAT THIS KIND IS. A place browsers come from. It holds credentials and the
   runbook for turning "nothing" into "a CDP URL an agent can drive". Two shapes
   fit here:

     - A hosted service you rent ephemeral browsers from (a browser-use Cloud
       account, a remote CDP service). Browsers are created and destroyed.
     - A host you run yourself that keeps browsers standing (an nbrowser box).
       Browsers are created once and stay up.

   Say which shape it is in the first paragraph, because the Cleanup sections of
   the identities that live on it are opposites: ephemeral browsers MUST be
   stopped or they bill, standing browsers must NOT be stopped because they are
   shared.

   WHAT DOES NOT GO HERE. The identities themselves. A provider that holds three
   logged-in browsers gets one artifact for the provider and three more with
   `kind: replay` or `kind: persistent`, each linking back here.

   SECRETS. The current workspace stance is that credentials are committed in
   plain text. Say so under Security, and treat anything written here as
   compromised once the Flint syncs to a remote. */

```markdown
---
id: [generate-uuid4]
tags:
  - "#ab/browser"
kind: provider
status: [active (usable now)|untested (recorded but never driven end-to-end)|retired (superseded or revoked)]
provider: [vendor or host slug, e.g. browser-use, nbrowser]
orbh-sessions:
template: "[[tmp-ab-provider-v0.1]]"
authors:
  - "[[@Person Name]]"
---

# What This Is

[One paragraph. Whose account or which host, what it is for, and — stated
 explicitly — whether the browsers it yields are EPHEMERAL (created per task,
 must be stopped) or STANDING (created once, must not be stopped). Say what
 makes it worth reaching for over a plain local browser: stealth, a specific
 egress country, a machine that stays awake, a live URL a human can take over.]

# Credentials

| What | Value | Used as |
|------|-------|---------|
| [API key, host address, or token] | `[literal value]` | `[ENV_VAR or flag]` |
| (continue) | | |

# Obtaining a Browser

/* The runbook, literal and copy-pasteable, with this provider's real values
   substituted in. An agent must not have to open vendor documentation. End at a
   CDP URL, because that is the only thing the rest of the shard needs. */

```bash
[the calls that produce a CDP URL, in order]
```

[Per-step notes: what a response looks like, which field to keep, what to do on
 failure. If a browser id must be recorded to stop it later, say so here and say
 where to record it.]

# Cleanup

/* Put the step that costs money or destroys state FIRST.
   For an ephemeral provider: closing locally does NOT stop a remote browser.
   For a standing provider: the correct cleanup is usually "release the claim
   and leave everything running" — say that plainly so nobody kills a shared
   browser being helpful. */

```bash
[the commands that actually release and stop everything, in the order that matters]
```

# Capacity and Cost

[What one browser costs and how it is metered, how many can run at once, and any
 lifetime ceiling. If it is free because you host it, say what the real limit is
 instead — memory, CPU, one profile per browser.]

# Limits and Gotchas

[Everything an agent would otherwise discover the hard way. Verified-broken
 behaviour is the most valuable line in the file — a negative result that cost
 someone an hour belongs here.]

- [limit, gotcha, or verified-broken behaviour]
- (continue)

# Identities On This Provider

/* Just the links. The identities own their own runbooks. */

- [[(Browser) NNN Name]] — [one line: what it is logged into]
- (continue)

# Security

[What this file exposes, the current stance, and what must happen when the
 stance changes — which keys have to be rotated rather than merely moved.]

# Log

- [YYYY-MM-DD]: [what was created, verified, changed, or broken — one line each]
- (continue)
```
