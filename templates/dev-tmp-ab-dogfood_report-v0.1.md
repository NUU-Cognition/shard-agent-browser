---
description: "Dogfood report structure — repro-first findings from an exploratory testing pass"
---

# Filename: {OUTPUT_DIR}/report.md

/* The dogfood report produced by [[dev-wkfl-ab-dogfood]]. It is written to the run's
   output directory (default ./dogfood-output/), NOT the Mesh — screenshot and
   video paths are relative to that directory. The frontmatter makes it a
   self-describing, typed artifact even though it lives outside Mesh/Types/.
   Copy the ### ISSUE- block once per finding. Interactive issues need a video +
   step-by-step screenshots; static issues (typos, visual glitches) need a single
   annotated screenshot and set Repro Video to N/A. */

```markdown
---
id: [generate-uuid4]
tags:
  - "#ab/dogfood_report"
status: [in-progress|final]
target-url: [the app URL that was tested]
session: [agent-browser session name used]
scope: [full app | the focus area tested]
orbh-sessions:
template: "[[dev-tmp-ab-dogfood_report-v0.1]]"
authors: /* from .flint/identity.json; omit if no identity set */
  - "[[@Person Name]]"
---

# Dogfood Report: [App name]

| Field | Value |
|-------|-------|
| **Date** | [ISO 8601 date of the run] |
| **App URL** | [target URL] |
| **Session** | [session name] |
| **Scope** | [full app | focus area] |

## Summary

/* Update these counts at wrap-up so every ISSUE block below is reflected. */

| Severity | Count |
|----------|-------|
| Critical | [n] |
| High | [n] |
| Medium | [n] |
| Low | [n] |
| **Total** | **[n]** |

## Issues

### ISSUE-001: [Short title]

| Field | Value |
|-------|-------|
| **Severity** | [critical|high|medium|low] |
| **Category** | [visual|functional|ux|content|performance|console|accessibility] |
| **URL** | [page URL where the issue was found] |
| **Repro Video** | [videos/issue-001-repro.webm | N/A for static issues] |

**Description**

[What is wrong, what was expected, and what actually happened.]

**Repro Steps**

/* Each step references its screenshot so a reader can follow along visually.
   For a static issue, replace the steps with a single annotated screenshot. */

1. [Navigate to / action] — ![Step 1](screenshots/issue-001-step-1.png)
2. [Action] — ![Step 2](screenshots/issue-001-step-2.png)
3. **Observe:** [what goes wrong] — ![Result](screenshots/issue-001-result.png)

- (continue with ISSUE-002, ISSUE-003, … — copy the block above)
```
