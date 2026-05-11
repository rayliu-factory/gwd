# Working in Teams

GWD supports multi-user workflows where several developers work on the same repository concurrently.

## Quick Setup

The simplest way: set team mode in your project preferences.

```yaml
# .gwd/PREFERENCES.md (committed to git)
---
version: 1
mode: team
---
```

This enables unique milestone IDs, push branches, pre-merge checks, and other team-appropriate defaults in one setting.

## What Team Mode Does

| Setting | Effect |
|---------|--------|
| `unique_milestone_ids` | IDs like `M001-eh88as` instead of `M001` — no collisions |
| `git.push_branches` | Milestone branches are pushed to remote |
| `git.pre_merge_check` | Validation runs before merging |

You can override individual settings on top of `mode: team`.

## Configure `.gitignore`

Share planning artifacts while keeping runtime files local:

```bash
# Runtime files (per-developer, gitignore these)
.gwd/auto.lock
.gwd/completed-units.json
.gwd/STATE.md
.gwd/gwd.db*
.gwd/metrics.json
.gwd/activity/
.gwd/runtime/
.gwd/worktrees/
.gwd/milestones/**/continue.md
.gwd/milestones/**/*-CONTINUE.md
```

**What gets shared** (committed to git):
- `.gwd/PREFERENCES.md` — project preferences
- `.gwd/PROJECT.md` — living project description
- `.gwd/REQUIREMENTS.md` — requirement contract
- `.gwd/DECISIONS.md` — architectural decisions
- `.gwd/milestones/` — roadmaps, plans, summaries, research

**What stays local** (gitignored):
- Database files, lock files, metrics, state projections, activity logs, worktrees

## Commit the Config

```bash
git add .gwd/PREFERENCES.md
git commit -m "chore: enable GWD team workflow"
```

## Keeping `.gwd/` Local

For teams where only some members use GWD:

```yaml
git:
  commit_docs: false
```

This gitignores `.gwd/` entirely. You get structured planning without affecting teammates.

## Parallel Development

Multiple developers can run auto mode simultaneously on different milestones. Each developer:

- Gets their own worktree (`.gwd/worktrees/<MID>/`)
- Works on a unique `milestone/<MID>` branch
- Squash-merges to main independently

Milestone dependencies can be declared:

```yaml
# In M00X-CONTEXT.md frontmatter
---
depends_on: [M001-eh88as]
---
```

GWD enforces that dependent milestones complete before starting downstream work.
