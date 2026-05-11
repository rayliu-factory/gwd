# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues on **`rayliu-factory/gwd`** (the `upstream` remote). Use the `gh` CLI for all operations.

This clone may have multiple remotes (`origin` is a personal fork, `upstream` is the canonical repo). Always pass `-R rayliu-factory/gwd` so commands hit the canonical tracker rather than auto-resolving to the fork.

## Conventions

- **Create an issue**: `gh issue create -R rayliu-factory/gwd --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> -R rayliu-factory/gwd --json number,title,body,labels,comments --jq '{number, title, body, labels: [.labels[].name], comments: [.comments[].body]}'`.
- **List issues**: `gh issue list -R rayliu-factory/gwd --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> -R rayliu-factory/gwd --body "..."`
- **Apply / remove labels**: `gh issue edit <number> -R rayliu-factory/gwd --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> -R rayliu-factory/gwd --comment "..."`

## When a skill says "publish to the issue tracker"

Create a GitHub issue on `rayliu-factory/gwd`.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> -R rayliu-factory/gwd --comments`.
