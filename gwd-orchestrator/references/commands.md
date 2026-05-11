# GWD Commands Reference

All commands run as subprocesses via `gwd headless [flags] [command] [args...]`.

## Global Flags

These flags apply to any `gwd headless` invocation:

| Flag | Description |
|------|-------------|
| `--output-format <fmt>` | `text` (default), `json` (structured result), `stream-json` (JSONL) |
| `--json` | Alias for `--output-format stream-json` |
| `--bare` | Minimal context: skip CLAUDE.md, AGENTS.md, user settings, user skills |
| `--resume <id>` | Resume a prior headless session by ID |
| `--timeout N` | Overall timeout in ms (default: 300000) |
| `--model ID` | Override LLM model |
| `--supervised` | Forward interactive UI requests to orchestrator via stdout/stdin |
| `--response-timeout N` | Timeout for orchestrator response in supervised mode (default: 30000ms) |
| `--answers <path>` | Pre-supply answers and secrets from JSON file |
| `--events <types>` | Filter JSONL output to specific event types (comma-separated, implies `--json`) |
| `--verbose` | Show tool calls in progress output |

## Exit Codes

| Code | Meaning | When |
|------|---------|------|
| `0` | Success | Unit/milestone completed normally |
| `1` | Error or timeout | Runtime error, LLM failure, or `--timeout` exceeded |
| `10` | Blocked | Execution hit a blocker requiring human intervention |
| `11` | Cancelled | User or orchestrator cancelled the operation |

## Workflow Commands

### `auto` (default)

Autonomous mode — loop through all pending units until milestone complete or blocked.

```bash
gwd headless --output-format json auto
```

### `next`

Step mode — execute exactly one unit (task/slice/milestone step), then exit. Recommended for orchestrators that need decision points between steps.

```bash
gwd headless --output-format json next
```

### `new-milestone`

Create a milestone from a specification document.

```bash
gwd headless new-milestone --context spec.md
gwd headless new-milestone --context spec.md --auto
gwd headless new-milestone --context-text "Build a REST API" --auto
cat spec.md | gwd headless new-milestone --context - --auto
```

Extra flags:
- `--context <path>` — path to spec/PRD file (use `-` for stdin)
- `--context-text <text>` — inline specification text
- `--auto` — start auto-mode after milestone creation

### `dispatch <phase>`

Force-route to a specific phase, bypassing normal state-machine routing.

```bash
gwd headless dispatch research
gwd headless dispatch plan
gwd headless dispatch execute
gwd headless dispatch complete
gwd headless dispatch reassess
gwd headless dispatch uat
gwd headless dispatch replan
```

### `discuss`

Start guided milestone/slice discussion.

```bash
gwd headless discuss
```

### `stop`

Stop auto-mode gracefully.

```bash
gwd headless stop
```

### `pause`

Pause auto-mode (preserves state, resumable).

```bash
gwd headless pause
```

## State Inspection

### `query`

**Instant JSON snapshot** — state, next dispatch, parallel costs. No LLM, ~50ms. The recommended way for orchestrators to inspect state.

```bash
gwd headless query
gwd headless query | jq '.state.phase'
gwd headless query | jq '.next'
gwd headless query | jq '.cost.total'
```

### `status`

Progress dashboard (TUI overlay — useful interactively, not for parsing).

```bash
gwd headless status
```

### `history`

Execution history. Supports `--cost`, `--phase`, `--model`, and `limit` arguments.

```bash
gwd headless history
```

## Unit Control

### `skip`

Prevent a unit from auto-mode dispatch.

```bash
gwd headless skip
```

### `undo`

Revert last completed unit. Use `--force` to bypass confirmation.

```bash
gwd headless undo
gwd headless undo --force
```

### `steer <description>`

Hard-steer plan documents during execution. Useful for mid-course corrections.

```bash
gwd headless steer "Skip the blocked dependency, use mock instead"
```

### `queue`

Queue and reorder future milestones.

```bash
gwd headless queue
```

## Configuration & Health

### `doctor`

Runtime health checks with auto-fix.

```bash
gwd headless doctor
```

### `prefs`

Manage preferences (global/project/status/wizard/setup).

```bash
gwd headless prefs
```

### `knowledge <rule|pattern|lesson>`

Add persistent project knowledge.

```bash
gwd headless knowledge "Always use UTC timestamps in API responses"
```

## Phases

GWD workflows progress through these phases:

```
pre-planning → needs-discussion → discussing → researching → planning →
executing → verifying → summarizing → advancing → validating-milestone →
completing-milestone → complete
```

Special phases: `paused`, `blocked`, `replanning-slice`

## Hierarchy

- **Milestone**: Shippable version (4–10 slices, 1–4 weeks)
- **Slice**: One demoable vertical capability (1–7 tasks, 1–3 days)
- **Task**: One context-window-sized unit of work (one session)
