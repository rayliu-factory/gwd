# GWD Namespace Hard Cutover Design

## Summary

Rename the product namespace from GSD / Get Shit Done to GWD / Get Work Done with a hard cutover. The new namespace is canonical across the CLI, package names, package scopes, runtime state, environment variables, extension identifiers, tool names, docs, and distribution metadata.

This is not a compatibility migration. Old `gsd` commands, `.gsd/` projects, `GSD_*` environment variables, package scopes, and VS Code command IDs are intentionally removed from the active product surface.

## Goals

- Make `gwd` the only supported CLI command.
- Move runtime state from `~/.gsd` and `.gsd/` to `~/.gwd` and `.gwd/`.
- Move environment variables from `GSD_*` to `GWD_*`.
- Rename package identity from `gsd-pi`, `@gsd/*`, and `@gsd-build/*` to `gwd-pi`, `@gwd/*`, and `@gwd-build/*`.
- Rename command, slash-command, tool, MCP, VS Code, web, and bundled-extension surfaces to `gwd`.
- Update current user-facing docs and examples to describe GWD.
- Rename exported cross-package code identifiers from `Gsd*` to `Gwd*` where they are part of the public or internal module contract.

## Non-Goals

- No `gsd` CLI alias.
- No `/gsd` slash-command alias.
- No `.gsd/` project or global state fallback.
- No `GSD_*` environment variable fallback.
- No automatic migration from `.gsd/` to `.gwd/`.
- No attempt to preserve old VS Code `gsd.*` command IDs or settings keys.
- No broad rewrite of every historical changelog entry unless it is part of current install, setup, or usage guidance.

## Namespace Rules

The canonical namespace is:

| Surface | New value |
| --- | --- |
| Brand | GWD / Get Work Done |
| CLI | `gwd` |
| Root npm package | `gwd-pi` |
| Package scopes | `@gwd/*`, `@gwd-build/*` |
| Project state directory | `.gwd/` |
| Global state directory | `~/.gwd/` |
| Runtime database | `.gwd/gwd.db` |
| Environment variables | `GWD_*` |
| Slash command prefix | `/gwd` |
| Tool prefix | `gwd_*` |
| VS Code command/settings/view prefix | `gwd` |
| VS Code chat participant | `@gwd` |
| Docker/repository namespace | `gwd-build` |

## Architecture

The cutover should be implemented by explicit surface inventory, not by blind global replacement. Each surface has different compatibility, build, and test risks.

### Distribution Identity

The root package changes from `gsd-pi` to `gwd-pi`. Public binaries change to `gwd` and `gwd-pi`; `gsd`, `gsd-cli`, and `gsd-pi` are removed or renamed rather than retained as aliases.

Workspace packages move from:

- `@gsd/*` to `@gwd/*`
- `@gsd-build/*` to `@gwd-build/*`
- `@gsd-extensions/*` to `@gwd-extensions/*`

Package metadata, repository URLs, badges, Docker image names, and publish scripts should use `gwd-build/gwd-2` and `gwd-build` package/image namespaces.

### Runtime State Identity

Global state uses `~/.gwd`. Project state uses `.gwd/`. File names that encode the product namespace should use `gwd`, including `gwd.db`.

The runtime should read only the new paths. Existing `.gsd/` directories should be treated the same as an absent project state directory. Existing `~/.gsd` global configuration should not be read.

### Environment Variables

All supported product environment variables move from `GSD_*` to `GWD_*`, including home directory, headless mode, RTK settings, provider fixture settings, workflow executor settings, project-root coordination, and worker locks.

The runtime should not read old variables. Tests should assert the old names do not affect behavior where the variable is security-sensitive or controls runtime state.

### Command And Extension Identity

Command surfaces move to `gwd`:

- CLI help and subcommands use `gwd`.
- Slash commands use `/gwd`.
- Tool names use `gwd_*`.
- MCP server binary names use `gwd-*`.
- VS Code commands/settings/views/chat participant move from `gsd.*` / `@gsd` to `gwd.*` / `@gwd`.
- Bundled extension directories and manifests that encode the product namespace move from `gsd` to `gwd`.

### Code Identifiers

Exported classes, types, functions, and public-ish cross-package names should move from `Gsd*` to `Gwd*`. Purely local variables can be renamed while touching their files, but the implementation plan should prioritize exported and manifest-facing identifiers first because they affect compile-time contracts.

## Data Flow

After the cutover:

1. A user installs `gwd-pi`.
2. The user runs `gwd`.
3. The loader initializes from `~/.gwd/agent`.
4. Project onboarding writes `.gwd/` artifacts and `.gwd/gwd.db`.
5. Auto mode, worktrees, reports, hooks, headless mode, MCP mode, web mode, VS Code, and bundled extensions all read and write `gwd` paths and `GWD_*` environment variables.
6. Documentation and generated help only describe the new namespace.

There is no migration path in this design. Users with old projects must initialize or manually move state outside this task.

## Error Handling

The expected hard-cutover behavior is direct failure or fresh initialization:

- `gsd` is not installed as a command.
- `/gsd` is not registered as a slash command.
- `.gsd/` does not make a project initialized.
- `GSD_*` variables are ignored.
- VS Code `gsd.*` commands and settings are absent.

The implementation should avoid bespoke migration warnings because warnings imply supported compatibility. Normal missing command, missing config, or uninitialized project behavior is sufficient.

## Testing

Testing should be layered around the renamed contracts:

- Package/build contract checks for root and workspace package names, imports, bins, lockfile references, and publish metadata.
- Unit tests for path and environment constants: `~/.gwd`, `.gwd`, `GWD_*`, and `gwd.db`.
- CLI/help tests that assert current help text says `gwd` and does not expose `gsd`.
- Project bootstrap/headless tests that assert `.gwd/` is created and `.gsd/` is ignored.
- VS Code manifest tests for command IDs, settings keys, view IDs, chat participant, default binary path, and visible titles.
- MCP/tooling tests for `gwd_*` tool names and `gwd-*` binary names.
- Docs smoke checks for current install/setup/usage docs.
- Broad regression coverage with `npm run test:unit` plus targeted integration tests for project bootstrap, headless query, and extension loading if full `npm test` is too expensive.

## Implementation Notes

The implementation should proceed in dependency order:

1. Package metadata, workspace names, imports, and lockfile/package references.
2. Central constants for app root, project state directory, database name, environment variable names, and command prefix.
3. Runtime code paths that derive state, session, worktree, hook, report, and extension locations.
4. CLI help, installer, update, Docker, and release scripts.
5. Bundled extensions, tool names, prompts, and tests.
6. VS Code extension manifest and source.
7. Current documentation and examples.
8. Final audit for remaining active `gsd`, `.gsd`, `GSD_`, `@gsd`, and `gsd-pi` references.

Because this is a hard cutover, any remaining old namespace reference after implementation should be either historical documentation or a test fixture explicitly proving old surfaces are not supported.

## Acceptance Criteria

- `gwd` is the primary CLI command and `gsd` is not exposed as an alias.
- The package graph builds using `gwd-pi`, `@gwd/*`, and `@gwd-build/*`.
- New project state is created under `.gwd/` with `gwd.db`.
- Global state resolves under `~/.gwd`.
- `GWD_*` variables are the only supported product environment variables.
- `/gwd` and `gwd_*` tool names are the active command/tool surfaces.
- VS Code uses `gwd` command IDs, settings keys, views, default binary path, and chat participant.
- Current docs and README install/use instructions refer to GWD.
- Targeted tests and the selected broad regression suite pass.
