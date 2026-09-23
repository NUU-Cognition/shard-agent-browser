---
id: 3f8c1d92-5a47-4b6e-9c03-7e2af8d51b64
tags:
  - "#f/metadata"
  - "#f/type"
---

# Browser

A Browser is a durable, named description of a browser the workspace can drive — where it comes from, what unlocks it, and the concrete procedure for turning it into something an agent is holding. It exists because the thing an agent needs to *find* outlives the thing an agent actually *uses*: a live session is claimed for one task and gone, while the account, the host, or the saved login behind it persists for months. A Browser is therefore a recipe and a keyring, never a live handle — the running session it produces lives on the Orbh session interface as that session's `browser` claim, and dies with it.

## Properties

| Property | Value |
|----------|-------|
| Tag | `#ab/browser` |
| Naming | `(Browser) NNN Name.md` |
| Location | `Mesh/Types/Browsers/` |
| Discriminator | `kind` frontmatter — one of `provider`, `replay`, `persistent` |

## Kinds

A Browser is one of three kinds, distinguished by the `kind` field. Each has its own template because their runbooks differ in ways that are not cosmetic.

| `kind` | What it describes | Identity lives in | Template |
|--------|-------------------|-------------------|----------|
| `provider` | An account or host that browsers are obtained *from* | — | `tmp-ab-provider-v0.1` |
| `replay` | One login, saved to a **state file**, rehydrated into fresh disposable browsers | a file | `tmp-ab-replay-v0.1` |
| `persistent` | One **standing self-hosted browser** whose login sits in a real profile on disk | a running browser | `tmp-ab-persistent-v0.1` |

`kind: browser` is the former name for `replay` and remains valid in existing artifacts.

**`replay` and `persistent` have opposite cleanup rules**, which is the reason they are separate kinds rather than one kind with a field. A replay identity runs on rented browsers that must be stopped or they keep billing; a persistent identity is shared and standing, and stopping it takes it away from everyone. An agent that applies the wrong rule either wastes money or destroys someone's working session.

## Addressing

Every identity carries a `stable-id` — a slug chosen once and never changed. It names the state file or the host-side identity, and the agent-browser session. A provider-side browser id is never a durable handle: it changes on every launch and exists only to stop that one browser.

## Lifecycle

```
untested → active → retired
```

`untested` means recorded but never driven end-to-end. Promote to `active` only after a real session has been driven against it.
