# GWD

**Get Work Done: an agentic coding CLI for planning, execution, verification, and shipping.**

GWD is a standalone CLI built on the Pi SDK. It manages project state, agent sessions, workflow tools, model routing, git isolation, recovery, and verification from one command-line entry point.

```bash
npm install -g @appfiex-rayliu/gwd@latest
gwd
```

[![npm version](https://img.shields.io/npm/v/@appfiex-rayliu/gwd?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/@appfiex-rayliu/gwd)
[![npm downloads](https://img.shields.io/npm/dm/@appfiex-rayliu/gwd?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/@appfiex-rayliu/gwd)
[![GitHub stars](https://img.shields.io/github/stars/rayliu-factory/gwd?style=for-the-badge&logo=github&color=181717)](https://github.com/rayliu-factory/gwd)
[![Discord](https://img.shields.io/badge/Discord-Join%20us-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/invite/nKXTsAcmbT)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

> GWD provisions a managed [RTK](https://github.com/rtk-ai/rtk) binary on supported macOS, Linux, and Windows installs to compress shell-command output in `bash`, `async_bash`, `bg_shell`, and verification flows. GWD forces `RTK_TELEMETRY_DISABLED=1` for all managed invocations. Set `GWD_RTK_DISABLED=1` to disable the integration.

> **NOTICE: New to Node on Mac?** If you installed Node.js via Homebrew, you may be running a development release instead of LTS. **[Read this guide](./docs/user-docs/node-lts-macos.md)** to pin Node 24 LTS and avoid compatibility issues.

---

## Initial Release Highlights

- **Agentic project loop** — plan milestones, execute tasks, verify results, and ship from one CLI.
- **GWD runtime state** — project artifacts live under `.gwd/`, with `gwd.db` as the authoritative runtime database and markdown projections for review.
- **Current command surface** — use `gwd` and `/gwd` commands only; old namespace aliases are intentionally not part of the initial release.
- **Contributor-ready docs** — user, GitBook, Mintlify, Docker, package, and developer docs now point to the `rayliu-factory/gwd` repository and current GWD package names.

---

## Documentation

Full documentation is in the [`docs/`](./docs/) directory:

### User Guides

- **[Getting Started](./docs/user-docs/getting-started.md)** — install, first run, basic usage
- **[Auto Mode](./docs/user-docs/auto-mode.md)** — autonomous execution deep-dive
- **[Configuration](./docs/user-docs/configuration.md)** — all preferences, models, git, and hooks
- **[Provider Setup](./docs/user-docs/providers.md)** — configure Ollama, vLLM Metal TurboQuant, LM Studio, and SGLang
- **[Custom Models](./docs/user-docs/custom-models.md)** — add custom providers (Ollama, vLLM, LM Studio, proxies)
- **[Token Optimization](./docs/user-docs/token-optimization.md)** — profiles, context compression, complexity routing
- **[Cost Management](./docs/user-docs/cost-management.md)** — budgets, tracking, projections
- **[Git Strategy](./docs/user-docs/git-strategy.md)** — worktree isolation, branching, merge behavior
- **[Parallel Orchestration](./docs/user-docs/parallel-orchestration.md)** — run multiple milestones simultaneously
- **[Working in Teams](./docs/user-docs/working-in-teams.md)** — unique IDs, shared artifacts
- **[Skills](./docs/user-docs/skills.md)** — bundled skills, discovery, custom authoring
- **[Commands Reference](./docs/user-docs/commands.md)** — all commands and keyboard shortcuts
- **[Troubleshooting](./docs/user-docs/troubleshooting.md)** — common issues, doctor, forensics, recovery
- **[Visualizer](./docs/user-docs/visualizer.md)** — workflow visualizer with stats and discussion status
- **[Remote Questions](./docs/user-docs/remote-questions.md)** — route decisions to Slack or Discord when human input is needed
- **[Dynamic Model Routing](./docs/user-docs/dynamic-model-routing.md)** — complexity-based model selection and budget pressure
- **[Web Interface](./docs/user-docs/web-interface.md)** — browser-based project management and real-time progress
- **[Import `.planning` Projects](./docs/user-docs/migration.md)** — import legacy `.planning` directories into `.gwd`
- **[Docker Sandbox](./docker/README.md)** — run GWD auto mode in an isolated Docker container

### Developer Docs

- **[Architecture](./docs/dev/architecture.md)** — system design and dispatch pipeline
- **[Contributor Architecture and Data Flow](./docs/dev/architecture-data-flow.md)** — repo map, runtime flow, and agent-oriented change paths
- **[CI/CD Pipeline](./docs/dev/ci-cd-pipeline.md)** — three-stage promotion pipeline (Dev → Test → Prod)
- **[E2E Testing](./tests/e2e/README.md)** — real-process CLI/runtime coverage and CI runner expectations
- **[Pipeline Simplification (ADR-003)](./docs/dev/ADR-003-pipeline-simplification.md)** — merged research into planning, mechanical completion
- **[VS Code Extension](./vscode-extension/README.md)** — chat participant, sidebar dashboard, RPC integration

---

## How It Works

GWD structures work into a hierarchy:

```
Milestone  →  a shippable version (4-10 slices)
  Slice    →  one demoable vertical capability (1-7 tasks)
    Task   →  one context-window-sized unit of work
```

The iron rule: **a task must fit in one context window.** If it can't, it's two tasks.

### The Loop

Each slice flows through phases automatically:

```
Plan (with integrated research) → Execute (per task) → Complete → Reassess Roadmap → Next Slice
                                                                                      ↓ (all slices done)
                                                                              Validate Milestone → Complete Milestone
```

**Plan** scouts the codebase, researches relevant docs, and decomposes the slice into tasks with must-haves (mechanically verifiable outcomes). **Execute** runs each task in a fresh context window with only the relevant files pre-loaded — then runs configured verification commands (lint, test, etc.) with auto-fix retries. **Complete** writes the summary, UAT script, marks the roadmap, and commits with meaningful messages derived from task summaries. **Reassess** checks if the roadmap still makes sense given what was learned. **Validate Milestone** runs a reconciliation gate after all slices complete — comparing roadmap success criteria against actual results before sealing the milestone.

### `/gwd auto` — The Main Event

This is what makes GWD different. Run it, walk away, come back to built software.

```
/gwd auto
```

Auto mode is a state machine driven by the GWD database at the project root. It derives the next unit of work from authoritative SQLite state, creates a fresh agent session, injects a focused prompt with all relevant context pre-inlined, and lets the LLM execute. When the LLM finishes, auto mode persists the result to the database, refreshes markdown projections such as `STATE.md`, and dispatches the next unit.

The database is authoritative for milestones, slices, tasks, requirements, decisions, summaries, and completion status. Markdown under `.gwd/` is a rendered projection for review, prompts, and git-friendly history; it is not a runtime fallback unless you explicitly run a recovery/import command. In worktree mode, project-root DB state remains authoritative and worktree markdown projections are not synced back as state.

**What happens under the hood:**

1. **Fresh session per unit** — Every task, every research phase, every planning step gets a clean 200k-token context window. No accumulated garbage. No "I'll be more concise now."

2. **Context pre-loading** — The dispatch prompt includes inlined task plans, slice plans, prior task summaries, dependency summaries, roadmap excerpts, and decisions register. The LLM starts with everything it needs instead of spending tool calls reading files.

3. **Context Mode** — Context Mode is enabled by default and gives eligible auto-mode units guidance for preserving context. Agents are steered toward `gwd_exec` for noisy scans, builds, tests, and diagnostics; capped stdout/stderr and metadata are saved under `.gwd/exec/` while only a short digest enters the conversation. `gwd_exec_search` lets agents reuse prior runs instead of repeating expensive checks, and `gwd_resume` reads a prior compaction snapshot from `.gwd/last-snapshot.md` when one exists. Opt out with `context_mode.enabled: false` to disable Context Mode guidance, snapshot injection, `gwd_exec`, `gwd_exec_search`, and `gwd_resume`; tune sandbox timeout/output caps and environment forwarding with `context_mode.exec_timeout_ms`, `context_mode.exec_stdout_cap_bytes`, `context_mode.exec_digest_chars`, and `context_mode.exec_env_allowlist`.

4. **Git isolation** — When `git.isolation` is set to `worktree` or `branch`, each milestone runs on its own `milestone/<MID>` branch (in a worktree or in-place). All slice work commits sequentially — no branch switching, no merge conflicts. When the milestone completes, it's squash-merged to main as one clean commit. The default is `none` (work on the current branch), configurable via preferences. If `worktree` is configured in a repo with no committed `HEAD`, GWD temporarily behaves as `none` until the first commit exists because git worktrees need a committed start point.

5. **Crash recovery** — Auto mode persists worker state, unit-dispatch state, and paused-session metadata in the project-root SQLite database. If the session dies, the next `/gwd auto` reconstructs the interrupted unit from DB-backed runtime state, reads the surviving session file, synthesizes a recovery briefing from every tool call that made it to disk, and resumes with full context. Parallel orchestrator IPC still lives under `.gwd/parallel/`, so multi-worker sessions survive crashes too. In headless mode, crashes trigger automatic restart with exponential backoff (default 3 attempts).

6. **Provider error recovery** — Transient provider errors (rate limits, 500/503 server errors, overloaded) auto-resume after a delay. Permanent errors (auth, billing) pause for manual review. The model fallback chain retries transient network errors before switching models.

7. **Stuck and artifact detection** — A sliding-window detector identifies repeated dispatch patterns (including multi-unit cycles). Missing expected artifacts use a separate bounded path: GWD retries artifact verification up to 3 times with failure context, then pauses auto mode with the missing artifact error instead of looping indefinitely.

8. **Timeout supervision** — Soft timeout warns the LLM to wrap up. Idle watchdog detects stalls. Hard timeout pauses auto mode. Recovery steering nudges the LLM to finish durable output before giving up.

9. **Cost tracking** — Every unit's token usage and cost is captured, broken down by phase, slice, and model. The dashboard shows running totals and projections. Budget ceilings can pause auto mode before overspending.

10. **Adaptive replanning** — After each slice completes, the roadmap is reassessed. If the work revealed new information that changes the plan, slices are reordered, added, or removed before continuing.

11. **Verification enforcement** — Configure shell commands (`npm run lint`, `npm run test`, etc.) that run automatically after task execution. Failures trigger auto-fix retries before advancing. Auto-discovered checks from `package.json` run in advisory mode — they log warnings but don't block on pre-existing errors. Configurable via `verification_commands`, `verification_auto_fix`, and `verification_max_retries` preferences.

12. **Milestone validation** — After all slices complete, a `validate-milestone` gate compares roadmap success criteria against actual results before sealing the milestone.

13. **Escape hatch** — Press Escape to pause. The conversation is preserved. Interact with the agent, inspect what happened, or just `/gwd auto` to resume from disk state.

### `/gwd` and `/gwd next` — Step Mode

By default, `/gwd` runs in **step mode**: the same state machine as auto mode, but it pauses between units with a wizard showing what completed and what's next. You advance one step at a time, review the output, and continue when ready.

- **No `.gwd/` directory** → Start a new project. Discussion flow captures your vision, constraints, and preferences.
- **Milestone exists, no roadmap** → Discuss or research the milestone.
- **Roadmap exists, slices pending** → Plan the next slice, execute one task, or switch to auto.
- **Mid-task** → Resume from where you left off.

`/gwd next` is an explicit alias for step mode. You can switch from step → auto mid-session via the wizard.

Step mode is the on-ramp. Auto mode is the highway.

---

## Getting Started

### Install

```bash
npm install -g @appfiex-rayliu/gwd
```

### Log in to a provider

First, choose your LLM provider:

```bash
gwd
/login
```

Select from 20+ providers — Anthropic, OpenAI, Google, OpenRouter, GitHub Copilot, and more. If you have a Claude Max or Copilot subscription, the OAuth flow handles everything. Otherwise, paste your API key when prompted.

GWD auto-selects a default model after login. To switch models later:

```bash
/model
```

### Use it

Open a terminal in your project and run:

```bash
gwd
```

GWD opens an interactive agent session. From there, you have two ways to work:

**`/gwd` — step mode.** Type `/gwd` and GWD executes one unit of work at a time, pausing between each with a wizard showing what completed and what's next. Same state machine as auto mode, but you stay in the loop. No project yet? It starts the discussion flow. Roadmap exists? It plans or executes the next step.

**`/gwd auto` — autonomous mode.** Type `/gwd auto` and walk away. GWD researches, plans, executes, verifies, commits, and advances through every slice until the milestone is complete. Fresh context window per task. No babysitting.

### Two terminals, one project

The real workflow: run auto mode in one terminal, steer from another.

**Terminal 1 — let it build**

```bash
gwd
/gwd auto
```

**Terminal 2 — steer while it works**

```bash
gwd
/gwd discuss    # talk through architecture decisions
/gwd status     # check progress
/gwd queue      # queue the next milestone
```

Both terminals coordinate through the same project-root GWD runtime on local disk. The SQLite database is authoritative, `.gwd/` markdown is refreshed from it, and your decisions in terminal 2 are picked up at the next phase boundary without stopping auto mode.

### Headless mode — CI and scripts

`gwd headless` runs any `/gwd` command without a TUI. Designed for CI pipelines, cron jobs, and scripted automation.

```bash
# Run auto mode in CI
gwd headless --timeout 600000

# Create and execute a milestone end-to-end
gwd headless new-milestone --context spec.md --auto

# One unit at a time (cron-friendly)
gwd headless next

# Instant JSON snapshot (no LLM, ~50ms)
gwd headless query

# Force a specific pipeline phase
gwd headless dispatch plan
```

Headless auto-responds to interactive prompts, detects completion, and exits with structured codes: `0` complete, `1` error/timeout, `2` blocked. Auto-restarts on crash with exponential backoff. Use `gwd headless query` for instant, machine-readable state inspection — returns phase, next dispatch preview, and parallel worker costs as a single JSON object without spawning an LLM session. Pair with [remote questions](./docs/user-docs/remote-questions.md) to route decisions to Slack or Discord when human input is needed.

**Multi-session orchestration** — headless mode supports DB-backed coordination across multiple GWD workers on the same machine. Worker registration, milestone leases, unit dispatch tracking, and command delivery live in `.gwd/gwd.db`, while `.gwd/parallel/` remains a local runtime area for per-milestone locks and isolation artifacts.

### First launch

On first run, GWD launches a branded setup wizard that walks you through LLM provider selection (OAuth or API key), then optional tool API keys (Brave Search, Context7, Jina, Slack, Discord). Every step is skippable — press Enter to skip any. If you have an existing Pi installation, your provider credentials (LLM and tool keys) are imported automatically. Run `gwd config` anytime to re-run the wizard.

### Commands

| Command                 | What it does                                                                  |
| ----------------------- | ----------------------------------------------------------------------------- |
| `/gwd`                  | Step mode — executes one unit at a time, pauses between each                  |
| `/gwd next`             | Explicit step mode (same as bare `/gwd`)                                      |
| `/gwd auto`             | Autonomous mode — researches, plans, executes, commits, repeats               |
| `/gwd new-project [--deep]` | Bootstrap a project with staged project-level discovery                  |
| `/gwd quick`            | Execute a quick task with GWD guarantees, skip planning overhead              |
| `/gwd stop`             | Stop auto mode gracefully                                                     |
| `/gwd steer`            | Hard-steer plan documents during execution                                    |
| `/gwd discuss`          | Discuss architecture and decisions (works alongside auto mode)                |
| `/gwd rethink`          | Conversational project reorganization                                         |
| `/gwd mcp`              | MCP server status and connectivity                                            |
| `/gwd status`           | Progress dashboard                                                            |
| `/gwd queue`            | Queue future milestones (safe during auto mode)                               |
| `/gwd prefs`            | Model selection, timeouts, budget ceiling                                     |
| `/gwd migrate`          | Import a `.planning` directory into `.gwd`                                    |
| `/gwd help`             | Categorized command reference for all GWD subcommands                         |
| `/gwd mode`             | Switch workflow mode (solo/team) with coordinated defaults                    |
| `/gwd workflow`         | Unified workflow plugins — list, run `<name>`, install, info, validate        |
| `/gwd start <template>` | Launch a bundled or custom workflow template (bugfix, release, etc.)          |
| `/gwd forensics`        | Full-access GWD debugger for auto-mode failure investigation                  |
| `/gwd cleanup`          | Archive phase directories from completed milestones                           |
| `/gwd doctor`           | Runtime health checks — issues surface across widget, visualizer, and reports |
| `/gwd keys`             | API key manager — list, add, remove, test, rotate, doctor                     |
| `/gwd logs`             | Browse activity, debug, and metrics logs                                      |
| `/gwd export --html`    | Generate HTML report for current or completed milestone                       |
| `/worktree` (`/wt`)     | Git worktree lifecycle — create, switch, merge, remove                        |
| `/gwd worktree` (`/gwd wt`) | TUI worktree management — list, merge, clean, remove with safety checks   |
| `/voice`                | Toggle real-time speech-to-text (macOS, Linux)                                |
| `/exit`                 | Graceful shutdown — saves session state before exiting                        |
| `/kill`                 | Kill GWD process immediately                                                  |
| `/clear`                | Start a new session (alias for `/new`)                                        |
| `Ctrl+Alt+G`            | Toggle dashboard overlay                                                      |
| `Ctrl+Alt+V`            | Toggle voice transcription                                                    |
| `Ctrl+Alt+B`            | Show background shell processes                                               |
| `Alt+V`                 | Paste clipboard image (macOS)                                                 |
| `gwd config`            | Re-run the setup wizard (LLM provider + tool keys)                            |
| `gwd setup vllm-metal-qwen36` | Print or start the vLLM Metal TurboQuant Qwen3.6 setup helper          |
| `gwd update`            | Update GWD to the latest version                                              |
| `gwd headless [cmd]`    | Run `/gwd` commands without TUI (CI, cron, scripts)                           |
| `gwd headless query`    | Instant JSON snapshot — state, next dispatch, costs (no LLM)                  |
| `gwd --continue` (`-c`) | Resume the most recent session for the current directory                      |
| `gwd --worktree` (`-w`) | Launch an isolated worktree session for the active milestone                  |
| `gwd sessions`          | Interactive session picker — browse and resume any saved session              |

---

## What GWD Manages For You

### Context Engineering

Every dispatch is carefully constructed. The LLM never wastes tool calls on orientation.

| Artifact           | Purpose                                                         |
| ------------------ | --------------------------------------------------------------- |
| `gwd.db`           | Authoritative runtime state for hierarchy and completion        |
| `PROJECT.md`       | Living doc — what the project is right now                      |
| `REQUIREMENTS.md`  | Project-level capability contract and out-of-scope list         |
| `DECISIONS.md`     | Append-only register of architectural decisions                 |
| `KNOWLEDGE.md`     | Cross-session rules, patterns, and lessons learned              |
| `RUNTIME.md`       | Runtime context — API endpoints, env vars, services              |
| `runtime/research-decision.json` | Deep-mode marker for project research vs skip       |
| `research/*.md`    | Optional deep-mode project research: stack, features, architecture, pitfalls |
| `STATE.md`         | Quick-glance dashboard rendered from the database                |
| `M001-ROADMAP.md`  | Milestone plan with slice checkboxes, risk levels, dependencies |
| `M001-CONTEXT.md`  | User decisions from the discuss phase                           |
| `M001-RESEARCH.md` | Codebase and ecosystem research                                 |
| `S01-PLAN.md`      | Slice task decomposition with must-haves                        |
| `T01-PLAN.md`      | Individual task plan with verification criteria                 |
| `T01-SUMMARY.md`   | What happened — YAML frontmatter + narrative                    |
| `S01-UAT.md`       | Human test script derived from slice outcomes                   |

### Git Strategy

Branch-per-slice with squash merge. Fully automated.

```
main:
  docs(M001/S04): workflow documentation and examples
  fix(M001/S03): bug fixes and doc corrections
  feat(M001/S02): API endpoints and middleware
  feat(M001/S01): data model and type system

gwd/M001/S01 (deleted after merge):
  feat(S01/T03): file writer with round-trip fidelity
  feat(S01/T02): markdown parser for plan files
  feat(S01/T01): core types and interfaces
```

One squash commit per milestone on main (or whichever branch you started from). The worktree is torn down after merge. Git bisect works. Individual milestones are revertable. Commit messages are generated from task summaries — no more generic "complete task" messages.

### Verification

Every task has must-haves — mechanically checkable outcomes:

- **Truths** — Observable behaviors ("User can sign up with email")
- **Artifacts** — Files that must exist with real implementation, not stubs
- **Key Links** — Imports and wiring between artifacts

The verification ladder: static checks → command execution → behavioral testing → human review (only when the agent genuinely can't verify itself).

### Dashboard

`Ctrl+Alt+G` or `/gwd status` opens a real-time overlay showing:

- Current milestone, slice, and task progress
- Auto mode elapsed time and phase
- Per-unit cost and token breakdown by phase, slice, and model
- Cost projections based on completed work
- Completed and in-progress units

### HTML Reports

After a milestone completes, GWD auto-generates a self-contained HTML report in `.gwd/reports/`. Each report includes project summary, progress tree, slice dependency graph (SVG DAG), cost/token metrics with bar charts, execution timeline, changelog, and knowledge base sections. No external dependencies — all CSS and JS are inlined, printable to PDF from any browser.

An auto-generated `index.html` shows all reports with progression metrics across milestones.

- **Automatic** — generated after milestone completion (configurable via `auto_report` preference)
- **Manual** — run `/gwd export --html` anytime

---

## Configuration

### Preferences

GWD preferences live in `~/.gwd/PREFERENCES.md` (global) or `.gwd/PREFERENCES.md` (project). Manage with `/gwd prefs`.

```yaml
---
version: 1
models:
  research: claude-sonnet-4-6
  planning:
    model: claude-opus-4-7
    fallbacks:
      - openrouter/z-ai/glm-5
      - openrouter/minimax/minimax-m2.5
  execution: claude-sonnet-4-6
  completion: claude-sonnet-4-6
skill_discovery: suggest
auto_supervisor:
  soft_timeout_minutes: 20
  idle_timeout_minutes: 10
  hard_timeout_minutes: 30
budget_ceiling: 50.00
unique_milestone_ids: true
verification_commands:
  - npm run lint
  - npm run test
auto_report: true
---
```

**Key settings:**

| Setting                           | What it controls                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `models.*`                        | Per-phase model selection — string for a single model, or `{model, fallbacks}` for automatic failover |
| `planning_depth`                  | `light` / `deep` — opt into staged project discovery before milestone planning                         |
| `skill_discovery`                 | `auto` / `suggest` / `off` — how GWD finds and applies skills                                         |
| `auto_supervisor.*`               | Timeout thresholds for auto mode supervision                                                          |
| `budget_ceiling`                  | USD ceiling — auto mode pauses when reached                                                           |
| `uat_dispatch`                    | Enable automatic UAT runs after slice completion                                                      |
| `always_use_skills`               | Skills to always load when relevant                                                                   |
| `skill_rules`                     | Situational rules for skill routing                                                                   |
| `skill_staleness_days`            | Skills unused for N days get deprioritized (default: 60, 0 = disabled)                                |
| `unique_milestone_ids`            | Uses unique milestone names to avoid clashes when working in teams of people                          |
| `git.isolation`                   | `none` (default), `worktree`, or `branch` — enable worktree or branch isolation for milestone work. `worktree` requires a committed `HEAD`; zero-commit repos temporarily run as `none`    |
| `git.manage_gitignore`            | Set `false` to prevent GWD from modifying `.gitignore`                                                |
| `context_mode.enabled`            | Context Mode is default-on; set `false` to disable prompt guidance, snapshot injection, `gwd_exec`, `gwd_exec_search`, and `gwd_resume` |
| `context_mode.exec_timeout_ms`    | Timeout for sandboxed `gwd_exec` runs (default: 30000)                                                |
| `context_mode.exec_stdout_cap_bytes` | Persisted stdout cap for `gwd_exec` output (default: 1048576)                                      |
| `context_mode.exec_digest_chars`  | Trailing stdout characters returned to the agent context (default: 300)                              |
| `context_mode.exec_env_allowlist` | Environment variables forwarded to sandboxed `gwd_exec` runs in addition to `PATH` and `HOME`        |
| `verification_commands`           | Array of shell commands to run after task execution (e.g., `["npm run lint", "npm run test"]`)        |
| `verification_auto_fix`           | Auto-retry on verification failures (default: true)                                                   |
| `verification_max_retries`        | Max retries for verification failures (default: 2)                                                    |
| `phases.require_slice_discussion` | Pause auto-mode before each slice for human discussion review                                         |
| `auto_report`                     | Auto-generate HTML reports after milestone completion (default: true)                                 |

### Agent Instructions

Place an `AGENTS.md` file in any directory to provide persistent behavioral guidance for that scope. Pi core loads `AGENTS.md` automatically (with `CLAUDE.md` as a fallback) at both user and project levels. Use these files for coding standards, architectural decisions, domain terminology, or workflow preferences.

> **Note:** The legacy `agent-instructions.md` format (`~/.gwd/agent-instructions.md` and `.gwd/agent-instructions.md`) is deprecated and no longer loaded. Migrate any existing instructions to `AGENTS.md` or `CLAUDE.md`.

### Debug Mode

Start GWD with `gwd --debug` to enable structured JSONL diagnostic logging. Debug logs capture dispatch decisions, state transitions, and timing data for troubleshooting auto-mode issues.

### Token Optimization

GWD includes a coordinated token optimization system that reduces usage by 40-60% on cost-sensitive workloads. Set a single preference to coordinate model tier selection, phase skipping, and context compression:

```yaml
token_profile: budget # or balanced (default), quality
```

| Profile    | Savings | What It Does                                                                     |
| ---------- | ------- | -------------------------------------------------------------------------------- |
| `budget`   | 40-60%  | Light/standard tier defaults, skip research/reassess, minimal context inlining   |
| `balanced` | 10-20%  | Standard tier for core work, light tier for simple work, standard context        |
| `quality`  | 0%      | Heavy tier for planning, standard tier for core work, full context               |

**Complexity-based routing** automatically classifies tasks as simple/standard/complex and routes to appropriate available models. Token profiles define provider-agnostic tier intentions, so simple docs tasks use a light-tier configured model and complex architectural work can use a heavy-tier configured model. The classification is heuristic (sub-millisecond, no LLM calls) and learns from outcomes via a persistent routing history.

**Budget pressure** graduates model downgrading as you approach your budget ceiling — 50%, 75%, and 90% thresholds progressively shift work to cheaper tiers.

See the full [Token Optimization Guide](./docs/user-docs/token-optimization.md) for details.

### Bundled Tools

GWD ships with 24 extensions, all loaded automatically:

| Extension              | What it provides                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **GWD**                | Core workflow engine, auto mode, commands, dashboard                                                                                                                                                                                                                                 |
| **Browser Tools**      | Playwright-based browser with form intelligence, intent-ranked element finding, semantic actions, PDF export, session state persistence, network mocking, device emulation, structured extraction, visual diffing, region zoom, test code generation, and prompt injection detection |
| **Search the Web**     | Brave Search, Tavily, or Jina page extraction                                                                                                                                                                                                                                        |
| **Google Search**      | Gemini-powered web search with AI-synthesized answers                                                                                                                                                                                                                                |
| **Context7**           | Up-to-date library/framework documentation                                                                                                                                                                                                                                           |
| **Background Shell**   | Long-running process management with readiness detection                                                                                                                                                                                                                             |
| **Async Jobs**         | Background bash commands with job tracking and cancellation                                                                                                                                                                                                                          |
| **Subagent**           | Delegated tasks with isolated context windows                                                                                                                                                                                                                                        |
| **GitHub**             | Full-suite GitHub issues and PR management via `/gh` command                                                                                                                                                                                                                         |
| **Mac Tools**          | macOS native app automation via Accessibility APIs                                                                                                                                                                                                                                   |
| **MCP Client**         | Native MCP server integration via @modelcontextprotocol/sdk                                                                                                                                                                                                                          |
| **Voice**              | Real-time speech-to-text transcription (macOS, Linux — Ubuntu 22.04+)                                                                                                                                                                                                                |
| **Slash Commands**     | Custom command creation                                                                                                                                                                                                                                                              |
| **Ask User Questions** | Structured user input with single/multi-select                                                                                                                                                                                                                                       |
| **Secure Env Collect** | Masked secret collection without manual .env editing                                                                                                                                                                                                                                 |
| **Remote Questions**   | Route decisions to Slack/Discord when human input is needed in headless/CI mode                                                                                                                                                                                                      |
| **Universal Config**   | Discover and import MCP servers and rules from other AI coding tools                                                                                                                                                                                                                 |
| **AWS Auth**           | Automatic Bedrock credential refresh for AWS-hosted models                                                                                                                                                                                                                           |
| **Ollama**             | First-class local LLM support via Ollama                                                                                                                                                                                                                                             |
| **Claude Code CLI**    | External provider extension for Claude Code CLI                                                                                                                                                                                                                                      |
| **cmux**               | Claude multiplexer integration — desktop notifications, sidebar metadata, visual subagent splits                                                                                                                                                                                     |
| **GitHub Sync**        | Auto-sync milestones to GitHub Issues, PRs, and Milestones                                                                                                                                                                                                                           |
| **LSP**                | Language Server Protocol — diagnostics, definitions, references, hover, rename                                                                                                                                                                                                       |
| **TTSR**               | Tool-triggered system rules — conditional context injection based on tool usage                                                                                                                                                                                                      |

### Bundled Agents

Five specialized subagents for delegated work:

| Agent              | Role                                                         |
| ------------------ | ------------------------------------------------------------ |
| **Scout**          | Fast codebase recon — returns compressed context for handoff |
| **Researcher**     | Web research — finds and synthesizes current information     |
| **Worker**         | General-purpose execution in an isolated context window      |
| **JavaScript Pro** | JavaScript-specialized execution and debugging               |
| **TypeScript Pro** | TypeScript-specialized execution and debugging               |

---

## Working in teams

The best practice for working in teams is to ensure unique milestone names across all branches (by using `unique_milestone_ids`) and checking in the right `.gwd/` artifacts to share valuable context between teammates.

### Suggested .gitignore setup

```bash
# ── GWD: Runtime / Ephemeral (per-developer, per-session) ──────────────────
# Auto-mode dispatch tracker — prevents re-running completed units (includes archived per-milestone files)
.gwd/completed-units*.json
# State manifest — workflow state for recovery
.gwd/state-manifest.json
# Derived state projection — regenerated from the authoritative database
.gwd/STATE.md
# Per-developer token/cost accumulator
.gwd/metrics.json
# Raw JSONL session dumps — crash recovery forensics, auto-pruned
.gwd/activity/
# Unit execution records — dispatch phase, timeouts, and recovery tracking
.gwd/runtime/
# Git worktree working copies
.gwd/worktrees/
# Parallel runtime locks and per-milestone isolation artifacts
.gwd/parallel/
# SQLite database and WAL sidecars — authoritative runtime state, local only
.gwd/gwd.db*
# Daily-rotated event journal — structured event log for forensics
.gwd/journal/
# Doctor run history — diagnostic check results
.gwd/doctor-history.jsonl
# Workflow event log — structured event stream
.gwd/event-log.jsonl
# Generated HTML reports (regenerable via /gwd export --html)
.gwd/reports/
# Session-specific interrupted-work markers
.gwd/milestones/**/continue.md
.gwd/milestones/**/*-CONTINUE.md
```

### Unique Milestone Names

Create or amend your `.gwd/PREFERENCES.md` file within the repo to include `unique_milestone_ids: true` e.g.

```markdown
---
version: 1
unique_milestone_ids: true
---
```

With the above `.gitignore` set up, the `.gwd/PREFERENCES.md` file is checked into the repo ensuring all teammates use unique milestone names to avoid collisions.

Milestone names will now be generated with a 6 char random string appended e.g. instead of `M001` you'll get something like `M001-ush8s3`

### Migrating an existing git ignored `.gwd/` folder

1. Ensure you are not in the middle of any milestones (clean state)
2. Update the `.gwd/` related entries in your `.gitignore` to follow the `Suggested .gitignore setup` section under `Working in teams` (ensure you are no longer blanket ignoring the whole `.gwd/` directory)
3. Update your `.gwd/PREFERENCES.md` file within the repo as per section `Unique Milestone Names`
4. If you want to update all your existing milestones use this prompt in GWD: `I have turned on unique milestone ids, please update all old milestone ids to use this new format e.g. M001-abc123 where abc123 is a random 6 char lowercase alpha numeric string. Update all references in all .gwd file contents, file names and directory names. Validate your work once done to ensure referential integrity.`
5. Commit to git

---

## Architecture

GWD is a TypeScript application that embeds the Pi coding agent SDK.

```
gwd (CLI binary)
  └─ loader.ts          Sets PI_PACKAGE_DIR, GWD env vars, dynamic-imports cli.ts
      └─ cli.ts         Wires SDK managers, loads extensions, starts InteractiveMode
          ├─ headless.ts     Headless orchestrator (spawns RPC child, auto-responds, detects completion)
          ├─ onboarding.ts   First-run setup wizard (LLM provider + tool keys)
          ├─ wizard.ts       Env hydration from stored auth.json credentials
          ├─ app-paths.ts    ~/.gwd/agent/, ~/.gwd/sessions/, auth.json
          ├─ resource-loader.ts  Syncs bundled extensions + agents to ~/.gwd/agent/
          └─ src/resources/
              ├─ extensions/gwd/    Core GWD extension (auto, state, commands, ...)
              ├─ extensions/...     21 supporting extensions
              ├─ agents/            scout, researcher, worker, javascript-pro, typescript-pro
              └─ GWD-WORKFLOW.md    Manual bootstrap protocol
```

**Key design decisions:**

- **`pkg/` shim directory** — `PI_PACKAGE_DIR` points here (not project root) to avoid Pi's theme resolution collision with our `src/` directory. Contains only `piConfig` and theme assets.
- **Two-file loader pattern** — `loader.ts` sets all env vars with zero SDK imports, then dynamic-imports `cli.ts` which does static SDK imports. This ensures `PI_PACKAGE_DIR` is set before any SDK code evaluates.
- **Always-overwrite sync** — `npm update -g` takes effect immediately. Bundled extensions and agents are synced to `~/.gwd/agent/` on every launch, not just first run.
- **DB-authoritative state** — the project-root GWD database is the runtime source of truth. `.gwd/` markdown files are rendered projections for review, prompt context, and git history. No in-memory state survives across sessions.

---

## Requirements

- **Node.js** ≥ 22.0.0 (24 LTS recommended)
- **An LLM provider** — any of the 20+ supported providers (see [Use Any Model](#use-any-model))
- **Git** — initialized automatically if missing

Optional:

- Brave Search API key (web research)
- Tavily API key (web research — alternative to Brave)
- Google Gemini API key (web research via Gemini Search grounding)
- Context7 API key (library docs)
- Jina API key (page extraction)

---

## Use Any Model

GWD isn't locked to one provider. It runs on the [Pi SDK](https://github.com/badlogic/pi-mono), which supports **20+ model providers** out of the box. Use different models for different phases — Opus for planning, Sonnet for execution, a fast model for research.

### Built-in Providers

Anthropic, Anthropic (Vertex AI), OpenAI, Google (Gemini), OpenRouter, GitHub Copilot, Amazon Bedrock, Azure OpenAI, Google Vertex, Groq, Cerebras, Mistral, xAI, HuggingFace, Vercel AI Gateway, and more.

### OAuth / Max Plans

If you have a **Claude Max**, **Codex**, or **GitHub Copilot** subscription, you can use those directly — Pi handles the OAuth flow. No API key needed.

> **⚠️ Important:** Using OAuth tokens from subscription plans outside their native applications may violate the provider's Terms of Service. In particular:
>
> - **Google Gemini** — Using Gemini CLI or Antigravity OAuth tokens in third-party tools has resulted in **Google account suspensions**. This affects your entire Google account, not just the Gemini service. **Use a Gemini API key instead.**
> - **Claude Max** — Anthropic's ToS may not explicitly permit OAuth use outside Claude's own applications.
> - **GitHub Copilot** — Usage outside GitHub's own tools may be restricted by your subscription terms.
>
> GWD supports API key authentication for all providers as the safe alternative. **We strongly recommend using API keys over OAuth for Google Gemini.**

### OpenRouter

[OpenRouter](https://openrouter.ai) gives you access to hundreds of models through a single API key. Use it to run GWD with Llama, DeepSeek, Qwen, or anything else OpenRouter supports.

### Per-Phase Model Selection

In your preferences (`/gwd prefs`), assign different models to different phases:

```yaml
models:
  research: openrouter/deepseek/deepseek-r1
  planning:
    model: claude-opus-4-7
    fallbacks:
      - openrouter/z-ai/glm-5
  execution: claude-sonnet-4-6
  completion: claude-sonnet-4-6
```

Use expensive models where quality matters (planning, complex execution) and cheaper/faster models where speed matters (research, simple completions). Each phase accepts a simple model string or an object with `model` and `fallbacks` — if the primary model fails (provider outage, rate limit, credit exhaustion), GWD automatically tries the next fallback. GWD tracks cost per-model so you can see exactly where your budget goes.

---

## Ecosystem

| Project                                                         | Description                                                                         |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [GWD Config Utility](https://github.com/jeremymcs/gwd2-config) | Standalone configuration tool for managing GWD preferences, providers, and API keys |

---

## Star History

<a href="https://star-history.com/#rayliu-factory/gwd&Date">
  <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=rayliu-factory/gwd&type=Date" />
</a>

---

## License

[MIT License](LICENSE)

---

<div align="center">

**Get Work Done with one CLI.**

**`npm install -g @appfiex-rayliu/gwd && gwd`**

</div>
