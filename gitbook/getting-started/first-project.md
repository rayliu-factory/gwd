# Your First Project

## Launch GWD

Open a terminal in any project directory (or an empty one) and run:

```bash
gwd
```

GWD shows a welcome screen with your version, active model, and available tool keys.

## Start a Discussion

Type `/gwd` to enter step mode. GWD reads the state of your project directory and determines the next logical action:

- **No `.gwd/` directory** — starts a discussion flow to capture your project vision
- **Milestone exists, no roadmap** — discuss or research the milestone
- **Roadmap exists, slices pending** — plan the next slice or execute a task
- **Mid-task** — resume where you left off

For a new project, GWD will ask you to describe what you want to build. Talk through your vision — GWD captures requirements, architectural decisions, and scope.

## The Project Hierarchy

After discussion, GWD organizes your work into:

```
Milestone  →  a shippable version (4-10 slices)
  Slice    →  one demoable feature (1-7 tasks)
    Task   →  one context-window-sized unit of work
```

The key rule: **a task must fit in one AI context window.** If it can't, it becomes two tasks.

## Run Auto Mode

Once you have a milestone and roadmap, let GWD take the wheel:

```
/gwd auto
```

GWD autonomously:
1. **Plans** each slice — scouts the codebase, researches docs, decomposes into tasks
2. **Executes** each task — writes code in a fresh AI session
3. **Completes** the slice — writes summaries, commits with meaningful messages
4. **Reassesses** the roadmap — checks if the plan still makes sense
5. **Repeats** until the milestone is done

## The Two-Terminal Workflow

The recommended approach: auto mode in one terminal, steering from another.

**Terminal 1 — let it build:**

```bash
gwd
/gwd auto
```

**Terminal 2 — steer while it works:**

```bash
gwd
/gwd discuss    # talk through architecture decisions
/gwd status     # check progress
/gwd queue      # queue the next milestone
/gwd capture "add rate limiting to the API"  # fire-and-forget thought
```

Both terminals read and write the same `.gwd/` files. Decisions in terminal 2 are picked up at the next phase boundary automatically.

## Check Progress

Press `Ctrl+Alt+G` or type `/gwd status` to see the dashboard:

- Current milestone, slice, and task
- Elapsed time and phase
- Per-unit cost and token breakdown
- Completed and in-progress work

## Resume a Session

```bash
gwd --continue    # or gwd -c
```

Resumes the most recent session for the current directory.

To browse and pick from all saved sessions:

```bash
gwd sessions
```

Shows each session's date, message count, and preview so you can choose which to resume.

## What's on Disk

GWD keeps authoritative runtime state in the project-root SQLite database and renders markdown projections into `.gwd/` inside your project:

```
.gwd/
  gwd.db              — authoritative runtime database (local, gitignored)
  PROJECT.md          — what the project is
  REQUIREMENTS.md     — requirement contract
  DECISIONS.md        — architectural decisions
  KNOWLEDGE.md        — cross-session rules and patterns
  STATE.md            — quick-glance status rendered from the database
  milestones/
    M001/
      M001-ROADMAP.md — slice plan with dependencies
      M001-CONTEXT.md — scope and goals
      slices/
        S01/
          S01-PLAN.md     — task decomposition
          S01-SUMMARY.md  — what happened
          S01-UAT.md      — test script
          tasks/
            T01-PLAN.md
            T01-SUMMARY.md
```

## Next Steps

- [Auto Mode](../core-concepts/auto-mode.md) — deep dive into autonomous execution
- [Preferences](../configuration/preferences.md) — model selection, timeouts, budgets
- [Commands](../reference/commands.md) — all commands and shortcuts
