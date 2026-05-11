# Import `.planning` Projects

If you have a project with a legacy `.planning` directory, import it into GWD's `.gwd` format.

## Running the Import

```bash
# From within the project directory
/gwd migrate

# Or specify a path
/gwd migrate ~/projects/my-old-project
```

## What Gets Migrated

The import tool:

- Parses your old `PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, phase directories, plans, summaries, and research
- Maps phases → slices, plans → tasks, milestones → milestones
- Writes the imported hierarchy into the GWD database, then renders markdown projections from that database
- Preserves completion state (`[x]` phases stay done, summaries carry over)
- Consolidates research files into the new structure
- Shows a preview before writing anything
- Optionally runs an agent-driven review of the output for quality assurance

## Supported Formats

The import handles these `.planning` format variations:

- Milestone-sectioned roadmaps with `<details>` blocks
- Bold phase entries
- Bullet-format requirements
- Decimal phase numbering
- Duplicate phase numbers across milestones

## Requirements

Import works best with a `ROADMAP.md` file for milestone structure. Without one, milestones are inferred from the `phases/` directory.

## Post-Import

After importing, verify the output with:

```
/gwd doctor
```

This checks database and projection integrity and flags any structural issues. Use `/gwd inspect` when you need database diagnostics.

If an existing project has markdown artifacts but a missing or damaged database, start GWD once so the database opens, then run:

```
/gwd recover
```

`/gwd recover` clears the persisted hierarchy plus validation-related state, including quality-gate rows and skipped-validation assessments, then reconstructs the milestone, slice, and task hierarchy from the rendered markdown on disk. It is an explicit destructive recovery/import operation; normal runtime does not silently derive state from markdown.
