# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues on **`gwd-build/gwd`** (the `upstream` remote). Use the `gh` CLI for all operations.

This clone may have multiple remotes (`origin` is a personal fork, `upstream` is the canonical repo). Always pass `-R gwd-build/gwd` so commands hit the canonical tracker rather than auto-resolving to the fork.

## Conventions

- **Create an issue**: `gh issue create -R gwd-build/gwd --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> -R gwd-build/gwd --json number,title,body,labels,comments --jq '{number, title, body, labels: [.labels[].name], comments: [.comments[].body]}'`.
- **List issues**: `gh issue list -R gwd-build/gwd --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> -R gwd-build/gwd --body "..."`
- **Apply / remove labels**: `gh issue edit <number> -R gwd-build/gwd --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> -R gwd-build/gwd --comment "..."`

## When a skill says "publish to the issue tracker"

Create a GitHub issue on `gwd-build/gwd`.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> -R gwd-build/gwd --comments`.
