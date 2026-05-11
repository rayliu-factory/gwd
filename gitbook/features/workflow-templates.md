# Workflow Templates

Workflow templates are pre-built patterns for common development tasks. Instead of setting up a full milestone for a quick bugfix or spike, use a template to get started immediately.

## Using Templates

```
/gwd start              # pick from available templates
/gwd start resume       # resume an in-progress workflow
```

## Available Templates

| Template | Purpose |
|----------|---------|
| `bugfix` | Fix a specific bug with diagnosis and verification |
| `spike` | Time-boxed investigation or prototype |
| `feature` | Standard feature development |
| `hotfix` | Urgent production fix |
| `refactor` | Code restructuring and cleanup |
| `security-audit` | Security review and remediation |
| `dep-upgrade` | Dependency update and migration |
| `full-project` | Complete project from scratch |

## Listing and Inspecting

```
/gwd templates                    # list all available templates
/gwd templates info <name>        # show details for a template
```

## Custom Workflows

Create your own workflow definitions:

```
/gwd workflow new                  # create a new workflow YAML
/gwd workflow run <name>           # start a workflow run
/gwd workflow list                 # list active runs
/gwd workflow validate <name>      # validate definition
/gwd workflow pause                # pause running workflow
/gwd workflow resume               # resume paused workflow
```

Custom workflows are defined in YAML and can specify phases, dependencies, and configuration for each step.
