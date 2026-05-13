# Commands Reference

## Session Commands

| Command | Description |
|---------|-------------|
| `/gwd` | Step mode — execute one unit at a time, pause between each |
| `/gwd next` | Explicit step mode (same as `/gwd`) |
| `/gwd auto` | Autonomous mode — research, plan, execute, commit, repeat |
| `/gwd quick` | Execute a quick task with GWD guarantees (atomic commits, state tracking) without full planning overhead |
| `/gwd stop` | Stop auto mode gracefully |
| `/gwd pause` | Pause auto-mode (preserves state, `/gwd auto` to resume) |
| `/gwd steer` | Hard-steer plan documents during execution |
| `/gwd discuss` | Discuss architecture and decisions (works alongside auto mode) |
| `/gwd status` | Progress dashboard |
| `/gwd widget` | Cycle dashboard widget: full / small / min / off |
| `/gwd queue` | Queue and reorder future milestones (safe during auto mode) |
| `/gwd capture` | Fire-and-forget thought capture (works during auto mode) |
| `/gwd triage` | Manually trigger triage of pending captures |
| `/gwd debug` | Create and inspect persistent /gwd debug sessions |
| `/gwd debug list` | List persisted debug sessions |
| `/gwd debug status <slug>` | Show status for one debug session slug |
| `/gwd debug continue <slug>` | Resume an existing debug session slug |
| `/gwd debug --diagnose` | Inspect malformed artifacts and session health (`--diagnose [<slug> | <issue text>]`) |
| `/gwd dispatch` | Dispatch a specific phase directly (research, plan, execute, complete, reassess, uat, replan) |
| `/gwd history` | View execution history (supports `--cost`, `--phase`, `--model` filters) |
| `/gwd forensics` | Full-access GWD debugger — structured anomaly detection, unit traces, and LLM-guided root-cause analysis for auto-mode failures |
| `/gwd cleanup` | Clean up GWD state files and stale worktrees |
| `/gwd worktree` (`/gwd wt`) | Manage GWD worktrees from the TUI |
| `/gwd visualize` | Open workflow visualizer (progress, deps, metrics, timeline) |
| `/gwd export --html` | Generate self-contained HTML report for current or completed milestone |
| `/gwd export --html --all` | Generate retrospective reports for all milestones at once |
| `/gwd update` | Update GWD to the latest version in-session |
| `/gwd knowledge` | Add persistent project knowledge (rule, pattern, or lesson) |
| `/gwd eval-review <sliceId>` | Audit a slice's AI evaluation strategy and write a scored `<sliceId>-EVAL-REVIEW.md`. Flags: `--force` overwrites; `--show` prints the existing audit. See [eval-review](eval-review.md). |
| `/gwd extract-learnings <MID>` | Extract structured Decisions, Lessons, Patterns, and Surprises from a completed milestone — writes `<MID>-LEARNINGS.md` audit trail, appends Patterns and Lessons to `.gwd/KNOWLEDGE.md`, and persists Decisions via the DECISIONS database. Runs automatically at milestone completion. |
| `/gwd fast` | Toggle service tier for supported models (prioritized API routing) |
| `/gwd rate` | Rate last unit's model tier (over/ok/under) — improves adaptive routing |
| `/gwd changelog` | Show categorized release notes |
| `/gwd logs` | Browse activity logs, debug logs, and metrics |
| `/gwd remote` | Control remote auto-mode |
| `/gwd help` | Categorized command reference with descriptions for all GWD subcommands |

## Configuration & Diagnostics

| Command | Description |
|---------|-------------|
| `/gwd prefs` | Model selection, timeouts, budget ceiling |
| `/gwd mode` | Switch workflow mode (solo/team) with coordinated defaults for milestone IDs, git commit behavior, and documentation |
| `/gwd config` | Re-run the provider setup wizard (LLM provider + tool keys) |
| `/gwd keys` | API key manager — list, add, remove, test, rotate, doctor |
| `/gwd doctor` | Runtime health checks with auto-fix — issues surface in real time across widget, visualizer, and HTML reports (v2.40) |
| `/gwd inspect` | Show SQLite DB diagnostics |
| `/gwd init` | Project init wizard — detect, configure, bootstrap `.gwd/` |
| `/gwd setup` | Global setup status and configuration |
| `/gwd skill-health` | Skill lifecycle dashboard — usage stats, success rates, token trends, staleness warnings |
| `/gwd skill-health <name>` | Detailed view for a single skill |
| `/gwd skill-health --declining` | Show only skills flagged for declining performance |
| `/gwd skill-health --stale N` | Show skills unused for N+ days |
| `/gwd hooks` | Show configured post-unit and pre-dispatch hooks |
| `/gwd run-hook` | Manually trigger a specific hook |
| `/gwd migrate` | Import a `.planning` directory into `.gwd` |
| `/gwd recover` | Explicitly reset database hierarchy plus persisted validation and quality-gate state, then reconstruct from rendered markdown after database loss or corruption |

## Milestone Management

| Command | Description |
|---------|-------------|
| `/gwd new-project [--deep]` | Bootstrap a new project; `--deep` enables staged project-level discovery |
| `/gwd new-milestone [--deep]` | Create a new milestone; `--deep` opts the project into deep planning mode |
| `/gwd skip` | Prevent a unit from auto-mode dispatch |
| `/gwd undo` | Revert last completed unit |
| `/gwd undo-task` | Reset a specific task's completion state (DB + markdown) |
| `/gwd reset-slice` | Reset a slice and all its tasks (DB + markdown) |
| `/gwd park` | Park a milestone — skip without deleting |
| `/gwd unpark` | Reactivate a parked milestone |
| Discard milestone | Available via `/gwd` wizard → "Milestone actions" → "Discard" |

## Parallel Orchestration

| Command | Description |
|---------|-------------|
| `/gwd parallel start` | Analyze eligibility, confirm, and start workers |
| `/gwd parallel status` | Show all workers with state, progress, and cost |
| `/gwd parallel stop [MID]` | Stop all workers or a specific milestone's worker |
| `/gwd parallel pause [MID]` | Pause all workers or a specific one |
| `/gwd parallel resume [MID]` | Resume paused workers |
| `/gwd parallel merge [MID]` | Merge completed milestones back to main |

See [Parallel Orchestration](./parallel-orchestration.md) for full documentation.

## Workflow Templates (v2.42)

| Command | Description |
|---------|-------------|
| `/gwd start` | Start a workflow template (bugfix, spike, feature, hotfix, refactor, security-audit, dep-upgrade, full-project) |
| `/gwd start resume` | Resume an in-progress workflow |
| `/gwd templates` | List available workflow templates |
| `/gwd templates info <name>` | Show detailed template info |

## Custom Workflows

The unified plugin system. Every workflow — bundled, user-authored, or
remotely installed — is discoverable via `/gwd workflow <name>` and declares
one of four execution modes:

| Mode              | What it does                                                                              |
|-------------------|-------------------------------------------------------------------------------------------|
| `oneshot`         | Prompt-only, no state, no branch. For reviews, triage, changelog generation.              |
| `yaml-step`       | Full engine with GRAPH.yaml, iterate, and shell-verify. For fan-out batch work.           |
| `markdown-phase`  | Multi-phase with STATE.json + phase-approval gates. For release, performance audit.       |
| `auto-milestone`  | Hooks into the full `/gwd auto` pipeline. Reserved for `full-project`.                    |

### Discovery order (project > global > bundled)

1. `.gwd/workflows/<name>.{yaml,md}` — project-local, checked into the repo.
2. `~/.gwd/workflows/<name>.{yaml,md}` — global, private to the machine.
3. Bundled — ships with GWD (see the full list with `/gwd workflow`).

Legacy `.gwd/workflow-defs/` YAML definitions are still picked up for
backwards compatibility.

### Commands

| Command | Description |
|---------|-------------|
| `/gwd workflow` | List all discoverable plugins, grouped by mode |
| `/gwd workflow <name> [args]` | Run a plugin directly (resolved via precedence chain) |
| `/gwd workflow info <name>` | Show plugin metadata — source, mode, phases, path |
| `/gwd workflow new` | Create a new workflow definition (via the `create-workflow` skill) |
| `/gwd workflow install <source>` | Install a plugin from `https://...`, `gist:<id>`, or `gh:owner/repo/path[@ref]` |
| `/gwd workflow uninstall <name>` | Remove an installed plugin and its provenance record |
| `/gwd workflow run <name> [k=v]` | Explicit YAML run form (same as `/gwd workflow <name>` for yaml-step plugins) |
| `/gwd workflow list` | List YAML workflow runs (history) |
| `/gwd workflow validate <name>` | Validate a YAML definition |
| `/gwd workflow pause` | Pause custom workflow auto-mode |
| `/gwd workflow resume` | Resume paused custom workflow auto-mode |

### Bundled plugins

- **Phased (`markdown-phase`)**: `bugfix`, `small-feature`, `spike`, `hotfix`,
  `refactor`, `security-audit`, `dep-upgrade`, `release`, `api-breaking-change`,
  `performance-audit`, `observability-setup`, `ci-bootstrap`.
- **Oneshot**: `pr-review`, `changelog-gen`, `issue-triage`, `pr-triage`,
  `onboarding-check`, `dead-code`, `accessibility-audit`.
- **YAML engine (`yaml-step`)**: `test-backfill`, `docs-sync`, `rename-symbol`,
  `env-audit`.
- **Auto-milestone**: `full-project` (reached via `/gwd start full-project` or
  `/gwd auto`).

### Authoring a custom plugin

Run `/gwd workflow new <name>` to scaffold via the `create-workflow` skill.
Plugins are plain YAML (`.yaml`) or markdown (`.md`) files. See
`src/resources/extensions/gwd/workflow-templates/` for bundled examples.

## Extensions

| Command | Description |
|---------|-------------|
| `/gwd extensions list` | List all extensions and their status. User-installed entries show `[user]` plus the install source |
| `/gwd extensions enable <id>` | Enable a disabled extension |
| `/gwd extensions disable <id>` | Disable an extension |
| `/gwd extensions info <id>` | Show extension details |
| `/gwd extensions install <spec>` | Install a user extension. `<spec>` is an npm package, a git URL, or a local path. Restart GWD to activate. (v2.78) |
| `/gwd extensions uninstall <id>` | Remove a user-installed extension. Warns if other extensions depend on it. (v2.78) |
| `/gwd extensions update [id]` | Update a single user-installed npm extension to its latest version, or all of them when `id` is omitted. Git/local installs are skipped — reinstall to update. (v2.78) |
| `/gwd extensions validate <path>` | Validate an extension package directory against the manifest schema before publishing or installing. (v2.78) |

Install sources are auto-detected: starts with `http(s)://` or ends with `.git` → git clone; contains `/` or `.` and exists on disk → local copy; otherwise → `npm pack`. Installed extensions land in `~/.gwd/extensions/<id>/` and the registry records the source so `update` can re-fetch.

## cmux Integration

| Command | Description |
|---------|-------------|
| `/gwd cmux status` | Show cmux detection, prefs, and capabilities |
| `/gwd cmux on` | Enable cmux integration |
| `/gwd cmux off` | Disable cmux integration |
| `/gwd cmux notifications on/off` | Toggle cmux desktop notifications |
| `/gwd cmux sidebar on/off` | Toggle cmux sidebar metadata |
| `/gwd cmux splits on/off` | Toggle cmux visual subagent splits |

## GitHub Sync (v2.39)

| Command | Description |
|---------|-------------|
| `/github-sync bootstrap` | Initial setup — creates GitHub Milestones, Issues, and draft PRs from current `.gwd/` state |
| `/github-sync status` | Show sync mapping counts (milestones, slices, tasks) |

Enable with `github.enabled: true` in preferences. Requires `gh` CLI installed and authenticated. Sync mapping is persisted in `.gwd/.github-sync.json`.

## Git Commands

| Command | Description |
|---------|-------------|
| `/worktree` (`/wt`) | Git worktree lifecycle — create, switch, merge, remove |

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

## Telegram Commands

The following commands are sent directly in your **Telegram chat** to a configured GWD bot — they are not GWD CLI commands. Telegram command polling runs every ~5 seconds while auto-mode is active. Each response is prefixed with the project name (e.g., `📁 MyProject`).

| Command | Description |
|---------|-------------|
| `/status` | Current milestone, active unit, and session cost |
| `/progress` | Roadmap overview — completed and open milestones |
| `/budget` | Token usage and cost for the current session |
| `/pause` | Pause auto-mode after the current unit finishes |
| `/resume` | Clear a pause directive and continue auto-mode |
| `/log [n]` | Last `n` activity log entries (default: 5) |
| `/help` | List all available Telegram commands |

**Requirements:** Telegram must be configured as your remote channel (`remote_questions.channel: telegram`). Commands are only processed while auto-mode is running. See [Remote Questions — Telegram Commands](./remote-questions.md#telegram-commands) for setup and details.

## Session Management

| Command | Description |
|---------|-------------|
| `/clear` | Start a new session (alias for `/new`) |
| `/exit` | Graceful shutdown — saves session state before exiting |
| `/kill` | Kill GWD process immediately |
| `/model` | Switch the active model |
| `/login` | Log in to an LLM provider |
| `/thinking` | Toggle thinking level during sessions |
| `/voice` | Toggle real-time speech-to-text (macOS, Linux) |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+G` | Toggle dashboard overlay |
| `Ctrl+Alt+V` | Toggle voice transcription |
| `Ctrl+Alt+B` | Show background shell processes |
| `Ctrl+V` / `Alt+V` | Paste image from clipboard (screenshot → vision input) |
| `Escape` | Pause auto mode (preserves conversation) |

> **Note:** In terminals without Kitty keyboard protocol support (macOS Terminal.app, JetBrains IDEs), slash-command fallbacks are shown instead of `Ctrl+Alt` shortcuts.
>
> **Tip:** If `Ctrl+V` is intercepted by your terminal (e.g. Warp), use `Alt+V` instead for clipboard image paste.

## CLI Flags

| Flag | Description |
|------|-------------|
| `gwd` | Start a new interactive session |
| `gwd --continue` (`-c`) | Resume the most recent session for the current directory |
| `gwd --model <id>` | Override the default model for this session |
| `gwd --print "msg"` (`-p`) | Single-shot prompt mode (no TUI) |
| `gwd --mode <text\|json\|rpc\|mcp>` | Output mode for non-interactive use |
| `gwd --list-models [search]` | List available models and exit |
| `gwd --web [path]` | Start browser-based web interface (optional project path) |
| `gwd --worktree` (`-w`) [name] | Start session in a git worktree (auto-generates name if omitted) |
| `gwd --no-session` | Disable session persistence |
| `gwd --extension <path>` | Load an additional extension (can be repeated) |
| `gwd --append-system-prompt <text>` | Append text to the system prompt |
| `gwd --tools <list>` | Comma-separated list of tools to enable |
| `gwd --version` (`-v`) | Print version and exit |
| `gwd --help` (`-h`) | Print help and exit |
| `gwd sessions` | Interactive session picker — list all saved sessions for the current directory and choose one to resume |
| `gwd --debug` | Enable structured JSONL diagnostic logging for troubleshooting dispatch and state issues |
| `gwd config` | Set up global API keys for search and docs tools (saved to `~/.gwd/agent/auth.json`, applies to all projects). See [Global API Keys](./configuration.md#global-api-keys-gwd-config). |
| `gwd setup vllm-metal-qwen36` | Print or start the vLLM Metal TurboQuant Qwen3.6 setup helper |
| `gwd update` | Update GWD to the latest version |
| `gwd headless new-milestone` | Create a new milestone from a context file (headless — no TUI required) |

## Headless Mode

`gwd headless` runs `/gwd` commands without a TUI — designed for CI, cron jobs, and scripted automation. It spawns a child process in RPC mode, auto-responds to interactive prompts, detects completion, and exits with meaningful exit codes.

```bash
# Run auto mode (default)
gwd headless

# Run a single unit
gwd headless next

# Instant JSON snapshot — no LLM, ~50ms
gwd headless query

# With timeout for CI
gwd headless --timeout 600000 auto

# Force a specific phase
gwd headless dispatch plan

# Create a new milestone from a context file and start auto mode
gwd headless new-milestone --context brief.md --auto

# Create a milestone from inline text
gwd headless new-milestone --context-text "Build a REST API with auth"

# Pipe context from stdin
echo "Build a CLI tool" | gwd headless new-milestone --context -
```

| Flag | Description |
|------|-------------|
| `--timeout N` | Overall timeout in milliseconds (default: 300000 / 5 min) |
| `--max-restarts N` | Auto-restart on crash with exponential backoff (default: 3). Set 0 to disable |
| `--json` | Stream all events as JSONL to stdout |
| `--model ID` | Override the model for the headless session |
| `--context <file>` | Context file for `new-milestone` (use `-` for stdin) |
| `--context-text <text>` | Inline context text for `new-milestone` |
| `--auto` | Chain into auto-mode after milestone creation |

**Exit codes:** `0` = complete, `1` = error or timeout, `2` = blocked.

Any `/gwd` subcommand works as a positional argument — `gwd headless status`, `gwd headless doctor`, `gwd headless dispatch execute`, etc.

### `gwd headless recover` (v2.79)

Non-TTY equivalent of `/gwd recover` — resets the DB hierarchy plus persisted validation and quality-gate state, then reconstructs from rendered markdown. Designed for CI, cron, and any environment where the interactive recover prompt cannot run.

```bash
gwd headless recover
```

Exits non-zero if recovery fails. Pair with `gwd headless query` afterwards to verify the rebuilt state.

### `gwd headless query`

Returns a single JSON object with the full project snapshot — no LLM session, no RPC child, instant response (~50ms). This is the recommended way for orchestrators and scripts to inspect GWD state.

```bash
gwd headless query | jq '.state.phase'
# "executing"

gwd headless query | jq '.next'
# {"action":"dispatch","unitType":"execute-task","unitId":"M001/S01/T03"}

gwd headless query | jq '.cost.total'
# 4.25
```

**Output schema:**

```json
{
  "state": {
    "phase": "executing",
    "activeMilestone": { "id": "M001", "title": "..." },
    "activeSlice": { "id": "S01", "title": "..." },
    "activeTask": { "id": "T01", "title": "..." },
    "registry": [{ "id": "M001", "status": "active" }, ...],
    "progress": { "milestones": { "done": 0, "total": 2 }, "slices": { "done": 1, "total": 3 } },
    "blockers": []
  },
  "next": {
    "action": "dispatch",
    "unitType": "execute-task",
    "unitId": "M001/S01/T01"
  },
  "cost": {
    "workers": [{ "milestoneId": "M001", "cost": 1.50, "state": "running", ... }],
    "total": 1.50
  }
}
```

## MCP Server Mode

`gwd --mode mcp` runs GWD as a [Model Context Protocol](https://modelcontextprotocol.io) server over stdin/stdout. This exposes all GWD tools (read, write, edit, bash, etc.) to external AI clients — Claude Desktop, VS Code Copilot, and any MCP-compatible host.

```bash
# Start GWD as an MCP server
gwd --mode mcp
```

The server registers all tools from the agent session and maps MCP `tools/list` and `tools/call` requests to GWD tool definitions. It runs until the transport closes.

## In-Session Update

`/gwd update` checks npm for a newer version of GWD and installs it without leaving the session.

```bash
/gwd update
# Current version: v2.36.0
# Checking npm registry...
# Updated to v2.37.0. Restart GWD to use the new version.
```

If already up to date, it reports so and takes no action.

## Export

`/gwd export` generates reports of milestone work.

```bash
# Generate HTML report for the active milestone
/gwd export --html

# Generate retrospective reports for ALL milestones at once
/gwd export --html --all
```

Reports are saved to `.gwd/reports/` with a browseable `index.html` that links to all generated snapshots.
