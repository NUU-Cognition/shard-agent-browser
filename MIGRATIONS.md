# Migrations

Migration notes for Agent Browser. Latest version at top, separated by `---`.

## 0.9.0 → 0.10.0 — three kinds, one template each

`(Browser)` artifacts now come in three kinds, and the single combined template was
split so each kind has its own. Nothing breaks automatically, but existing
artifacts point at a template that no longer exists and should be repointed.

**What changed**

- `tmp-ab-browser-v0.2` — **removed**. It described two kinds in one file with
  "delete this section if…" comments, which does not survive a third kind.
- New: `tmp-ab-provider-v0.1`, `tmp-ab-replay-v0.1`, `tmp-ab-persistent-v0.1`.
- New kind `persistent` — a standing self-hosted browser whose login lives in a
  real profile on disk rather than a state file.
- `kind: browser` is renamed to `kind: replay`. **The old value is still accepted**
  everywhere, including `flint shard ab login`, so this rename is optional.
- New knowledge file `knw-ab-selfhosted`, added to required reading.

**Per-Flint steps**

For each artifact in `Mesh/Types/Browsers/`, update the `template:` field:

| If the artifact has | Set `template:` to |
|---------------------|--------------------|
| `kind: provider` | `"[[tmp-ab-provider-v0.1]]"` |
| `kind: browser` or `kind: replay` | `"[[tmp-ab-replay-v0.1]]"` |
| `kind: persistent` | `"[[tmp-ab-persistent-v0.1]]"` |

Optionally also change `kind: browser` to `kind: replay`. If you do, nothing else
needs touching — the login script accepts both.

No content restructuring is required: the new templates describe the same sections
the old one did, plus a `Concurrency` section on `persistent` and a clearer split
of the Cleanup rules.

**Why the split**

`replay` and `persistent` have opposite Cleanup rules — one must be stopped or it
bills, the other must never be stopped because it is shared. Two artifacts whose
Cleanup sections say opposite things should not share a template.
