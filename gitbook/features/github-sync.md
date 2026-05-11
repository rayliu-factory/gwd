# GitHub Sync

GWD can auto-sync milestones, slices, and tasks to GitHub Issues, PRs, and Milestones.

## Setup

1. Install and authenticate the `gh` CLI:
   ```bash
   gh auth login
   ```

2. Enable in preferences:
   ```yaml
   github:
     enabled: true
     repo: "owner/repo"              # auto-detected from git remote if omitted
     labels: [gwd, auto-generated]   # labels for created items
   ```

## Commands

| Command | Description |
|---------|-------------|
| `/github-sync bootstrap` | Initial setup — creates GitHub Milestones, Issues, and draft PRs from current `.gwd/` state |
| `/github-sync status` | Show sync mapping counts (milestones, slices, tasks) |

## How It Works

- Milestones → GitHub Milestones
- Slices → GitHub Issues (linked to milestone)
- Tasks → GitHub Issue checklists
- Completed slices → Draft PRs

Sync mapping is persisted in `.gwd/.github-sync.json`. The sync is rate-limit aware — it skips when the GitHub API rate limit is low.

## Configuration

```yaml
github:
  enabled: true
  repo: "owner/repo"
  labels: [gwd, auto-generated]
  project: "Project ID"           # optional: GitHub Project board
```
