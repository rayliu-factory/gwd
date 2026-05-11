# Commands

## Session Commands

| Command | Description |
|---------|-------------|
| `/gwd` | Step mode — execute one unit at a time |
| `/gwd auto` | Autonomous mode — research, plan, execute, commit, repeat |
| `/gwd quick` | Quick task with GWD guarantees but no full planning |
| `/gwd stop` | Stop auto mode gracefully |
| `/gwd pause` | Pause auto mode (preserves state) |
| `/gwd steer` | Modify plan documents during execution |
| `/gwd discuss` | Discuss architecture and decisions |
| `/gwd status` | Progress dashboard |
| `/gwd widget` | Cycle dashboard widget: full / small / min / off |
| `/gwd queue` | Queue and reorder future milestones |
| `/gwd capture` | Fire-and-forget thought capture |
| `/gwd triage` | Manually trigger capture triage |
| `/gwd debug` | Create and inspect persistent /gwd debug sessions |
| `/gwd debug list` | List persisted debug sessions |
| `/gwd debug status <slug>` | Show status for one debug session slug |
| `/gwd debug continue <slug>` | Resume an existing debug session slug |
| `/gwd debug --diagnose` | Inspect malformed artifacts and session health (`--diagnose [<slug> | <issue text>]`) |
| `/gwd dispatch` | Dispatch a specific phase directly |
| `/gwd history` | View execution history (supports `--cost`, `--phase`, `--model` filters) |
| `/gwd forensics` | Full debugger for auto-mode failures (includes worktree lifecycle telemetry) |
| `/gwd cleanup` | Clean up state files and stale worktrees |
| `/gwd worktree` (`/gwd wt`) | Manage GWD worktrees from the TUI |
| `/gwd visualize` | Open workflow visualizer |
| `/gwd export --html` | Generate HTML report for current milestone |
| `/gwd export --html --all` | Generate reports for all milestones |
| `/gwd update` | Update GWD to the latest version |
| `/gwd knowledge` | Add persistent project knowledge |
| `/gwd fast` | Toggle service tier for supported models |
| `/gwd rate` | Rate last unit's model tier (over/ok/under) |
| `/gwd changelog` | Show release notes |
| `/gwd logs` | Browse activity and debug logs |
| `/gwd remote` | Control remote auto-mode |
| `/gwd help` | Show all available commands |

## Configuration & Diagnostics

| Command | Description |
|---------|-------------|
| `/gwd prefs` | Preferences wizard |
| `/gwd mode` | Switch workflow mode (solo/team) |
| `/gwd config` | Re-run provider setup wizard |
| `/gwd keys` | API key manager |
| `/gwd doctor` | Runtime health checks with auto-fix |
| `/gwd inspect` | Show database diagnostics |
| `/gwd init` | Project init wizard |
| `/gwd setup` | Global setup status |
| `/gwd skill-health` | Skill lifecycle dashboard |
| `/gwd hooks` | Show configured hooks |
| `/gwd migrate` | Import a `.planning` directory into `.gwd` |
| `/gwd recover` | Explicitly reconstruct database hierarchy state from rendered markdown after database loss or corruption |

## Milestone Management

| Command | Description |
|---------|-------------|
| `/gwd new-project [--deep]` | Bootstrap a new project; `--deep` enables staged project-level discovery |
| `/gwd new-milestone [--deep]` | Create a new milestone; `--deep` opts the project into deep planning mode |
| `/gwd skip` | Prevent a unit from auto-mode dispatch |
| `/gwd undo` | Revert last completed unit |
| `/gwd undo-task` | Reset a specific task's completion state |
| `/gwd reset-slice` | Reset a slice and all its tasks |
| `/gwd park` | Park a milestone (skip without deleting) |
| `/gwd unpark` | Reactivate a parked milestone |

## Parallel Orchestration

| Command | Description |
|---------|-------------|
| `/gwd parallel start` | Analyze and start parallel workers |
| `/gwd parallel status` | Show worker state and progress |
| `/gwd parallel stop [MID]` | Stop workers |
| `/gwd parallel pause [MID]` | Pause workers |
| `/gwd parallel resume [MID]` | Resume workers |
| `/gwd parallel merge [MID]` | Merge completed milestones |

## Workflow Templates

| Command | Description |
|---------|-------------|
| `/gwd start` | Start a workflow template |
| `/gwd start resume` | Resume an in-progress workflow |
| `/gwd templates` | List available templates |
| `/gwd templates info <name>` | Show template details |

## Custom Workflows

| Command | Description |
|---------|-------------|
| `/gwd workflow new` | Create a workflow definition |
| `/gwd workflow run <name>` | Start a workflow run |
| `/gwd workflow list` | List workflow runs |
| `/gwd workflow validate <name>` | Validate a workflow YAML |
| `/gwd workflow pause` | Pause workflow auto-mode |
| `/gwd workflow resume` | Resume paused workflow |

## Extensions

| Command | Description |
|---------|-------------|
| `/gwd extensions list` | List all extensions |
| `/gwd extensions enable <id>` | Enable an extension |
| `/gwd extensions disable <id>` | Disable an extension |
| `/gwd extensions info <id>` | Show extension details |

## GitHub Sync

| Command | Description |
|---------|-------------|
| `/github-sync bootstrap` | Initial GitHub sync setup |
| `/github-sync status` | Show sync mapping counts |

## Session Management

| Command | Description |
|---------|-------------|
| `/clear` | Start a new session |
| `/exit` | Graceful shutdown |
| `/model` | Switch the active model |
| `/login` | Log in to an LLM provider |
| `/thinking` | Toggle thinking level |
| `/voice` | Toggle speech-to-text |
| `/worktree` (`/wt`) | Git worktree management |

## GWD Worktree Commands

Use `/gwd worktree` from an active TUI session to inspect and clean up GWD-managed worktrees without leaving the conversation. `/gwd wt` is an alias.

| Command | Description |
|---------|-------------|
| `/gwd worktree list` | Show each worktree, branch, path, clean/unmerged/uncommitted status, diff stats, and commit count. Alias: `/gwd worktree ls`. |
| `/gwd worktree merge [name]` | Merge a worktree into the detected main branch, then remove the worktree and its branch. The name is optional only when exactly one worktree exists. |
| `/gwd worktree clean` | Remove only merged or empty worktrees. Worktrees with unmerged diffs or uncommitted changes are kept. |
| `/gwd worktree remove <name> [--force]` | Remove a named worktree and delete its branch. Refuses unmerged or uncommitted work unless `--force` is supplied. Alias: `/gwd worktree rm`. |

Safety behavior:

- `merge` auto-commits dirty worktree changes before merging when possible.
- `merge` refuses to continue if the project root is not on the detected main branch; check out the main branch and rerun it.
- `clean` never deletes worktrees with pending file changes.
- `remove` requires `--force` to discard unmerged or uncommitted work.

## In-Session Update

```
/gwd update
```

Checks npm for a newer version and installs it without leaving the session.
