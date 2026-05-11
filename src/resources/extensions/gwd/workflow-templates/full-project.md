# Full Project Workflow

<template_meta>
name: full-project
version: 1
mode: auto-milestone
requires_project: true
artifact_dir: .gwd/
</template_meta>

<purpose>
The complete GWD workflow with full ceremony: roadmap, milestones, slices, tasks,
research, planning, execution, and verification. Use for greenfield projects or
major features that need the full planning apparatus.

This template wraps the existing GWD workflow for registry completeness.
When selected, it routes to the standard /gwd init → /gwd auto pipeline.
</purpose>

<phases>
1. init    — Initialize project, detect stack, create .gwd/
2. discuss — Define requirements, decisions, and architecture
3. plan    — Create roadmap with milestones and slices
4. execute — Execute slices: research → plan → implement → verify per slice
5. verify  — Milestone-level verification and completion
</phases>

<process>

## Routing to Standard GWD

This template is a convenience entry point. When selected via `/gwd start full-project`,
it should route to the standard GWD workflow:

1. If `.gwd/` doesn't exist: Run `/gwd init` to bootstrap the project
2. If `.gwd/` exists but no milestones: Start the discuss phase via `/gwd discuss`
3. If milestones exist: Resume via `/gwd auto` or `/gwd next`

The full GWD workflow protocol is defined in `GWD-WORKFLOW.md` and handles all
phases, state tracking, and agent orchestration.

</process>
