# GWD Independent Initial Release Cutover Design

## Summary

Complete a strict namespace cutover from GSD / Get Shit Done to GWD / Get Work Done for an independent initial release.

This release has no compatibility promise for old GSD users because no one has used this version yet. The active product surface should be GWD-only across runtime state, command-line behavior, tests, package metadata, repository links, VS Code integration, Docker/CI metadata, and every current README, Markdown, and MDX documentation file. The release version should reset to `0.0.1`.

This design supersedes the earlier May 10 GWD namespace hard-cutover design where it conflicts, especially around repository identity and initial release metadata.

## Goals

- Make `rayliu-factory/gwd` the canonical repository path for active package, docs, Docker, CI, native-package, and extension metadata.
- Set active release metadata to version `0.0.1` for the initial independent GWD release.
- Make `GWD`, `Get Work Done`, `gwd`, `@appfiex-rayliu/gwd`, `@gwd/*`, and `@gwd-build/*` the active product identity.
- Use `gwd`, `/gwd`, `gwd_*`, `GWD_*`, `.gwd/`, `~/.gwd/`, and `gwd.db` for all active runtime surfaces.
- Rename active extension, test, prompt, template, package-script, and resource paths that currently encode `gsd`.
- Update all current README, Markdown, and MDX docs so user-facing and contributor-facing instructions describe GWD, not GSD.
- Tighten namespace auditing so active old namespace drift is caught in CI.

## Non-Goals

- No `gsd` CLI alias.
- No `/gsd` slash-command alias.
- No `gsd_*` tool alias.
- No `GSD_*` environment variable fallback.
- No `.gsd/` or `~/.gsd/` state fallback.
- No automatic migration from `.gsd/` to `.gwd/`.
- No preservation of VS Code `gsd.*` commands, settings, view IDs, or chat participant names.
- No effort to keep old package names or package scopes installable.
- No broad semantic rewrite of historical changelog entries or old design docs beyond preventing current install/setup guidance from pointing users to GSD.

## Namespace Rules

The canonical active namespace is:

| Surface | Value |
| --- | --- |
| Brand | GWD / Get Work Done |
| Repository | `rayliu-factory/gwd` |
| Release version | `0.0.1` |
| CLI | `gwd` |
| Root npm package | `@appfiex-rayliu/gwd` |
| Package scopes | `@gwd/*`, `@gwd-build/*`, `@gwd-extensions/*` |
| Project state directory | `.gwd/` |
| Global state directory | `~/.gwd/` |
| Runtime database | `.gwd/gwd.db` |
| Environment variables | `GWD_*` |
| Slash command prefix | `/gwd` |
| Tool prefix | `gwd_*` |
| Bundled workflow extension | `gwd` |
| VS Code prefix | `gwd` |
| VS Code chat participant | `@gwd` |
| Docker images | `ghcr.io/rayliu-factory/gwd-*` |

## Architecture

`src/namespace.ts` should remain the source of truth for active product names. Code that needs product paths, env names, command names, or tool prefixes should import constants from that module or from a closely scoped derivative instead of embedding string literals.

The implementation should remove active GSD surfaces instead of adding aliases. Because this is a new independent initial release, compatibility code would be dead weight and would make audit results ambiguous.

The active bundled workflow extension should be renamed from `src/resources/extensions/gsd` to `src/resources/extensions/gwd`. Imports, package scripts, test runners, prompt references, templates, schemas, package metadata, and generated-resource paths should follow that rename. Public-ish exported identifiers that encode `Gsd` should become `Gwd` when they are part of cross-module or cross-package contracts.

Current documentation should describe GWD from scratch. The root README should not present the project as "GSD 2" or as an evolution of Get Shit Done. Contributor docs, user docs, GitBook docs, Mintlify docs, Docker docs, package READMEs, tests READMEs, and extension SDK docs should use GWD terminology and active `gwd` commands.

Historical material can remain only when it is intentionally historical, not active guidance. The namespace audit should document each historical allowlist entry so future changes do not expand the exception set accidentally.

## Components

### Release And Package Identity

Set root and release-bearing workspace versions to `0.0.1`. Update lockfiles through package tooling where practical so manifest and lockfile metadata stay aligned.

Package metadata should point at `https://github.com/rayliu-factory/gwd` and `https://github.com/rayliu-factory/gwd/issues`. Badges, Docker image tags, native package repository URLs, VS Code marketplace metadata, and package README links should use the same active repository identity.

### Runtime Namespace

Runtime state should resolve to `~/.gwd` globally and `.gwd/` per project. The database file is `gwd.db`. Runtime code should ignore `GSD_*` variables and `.gsd/` directories the same way it would ignore unrelated files.

Bootstrap, onboarding, headless mode, doctor, web mode, worktrees, reports, hooks, resource loading, skill discovery, extension discovery, and test fixtures should all use `.gwd/` paths.

### Bundled Workflow Extension

Rename the active workflow extension and package identity from GSD to GWD. This includes directory names, import paths, package manifests, extension IDs, test paths, command handlers, prompt files, templates, schemas, and any hard-coded path in package scripts.

The tool API should expose `gwd_*` tools only. Prompts should instruct agents to use `gwd_*` tools and `.gwd/` artifacts.

### Command Line And Docs

The CLI should expose `gwd` and `/gwd` only. Help text, install snippets, examples, command tables, troubleshooting guidance, and getting-started flows should not mention `gsd` as an active command.

All README, Markdown, and MDX files in the active source tree are in scope. Generated output, dependencies, and build output should be excluded from manual doc updates and from the active namespace audit.

### VS Code Extension

The VS Code extension should use GWD branding and `gwd` IDs throughout. Commands, settings, view containers, views, SCM provider IDs, chat participant names, default binary path, README content, and tests should be renamed. There is no requirement to preserve existing `gsd.*` command IDs.

### Tests And Audit

Tests should create `.gwd` fixtures and assert GWD command/tool/env names. The namespace audit should fail on active occurrences of:

- `GSD` as current branding
- `Get Shit Done`
- `gsd` as active namespace token
- `GSD_*`
- `.gsd`
- `/gsd`
- `gsd_*`
- `gsd-pi`
- `@gsd`
- `gsd-build`
- `gwd-build/gwd-2` or other non-`rayliu-factory/gwd` active repo paths

The audit should ignore `node_modules`, build output, generated test output, and a minimal explicit historical allowlist.

## Data Flow

The active runtime flow after the cutover is:

1. The user installs `@appfiex-rayliu/gwd@0.0.1`.
2. The user runs `gwd`.
3. The loader initializes global state under `~/.gwd`.
4. The loader discovers the bundled `gwd` workflow extension.
5. Project onboarding creates `.gwd/`.
6. Runtime opens `.gwd/gwd.db`.
7. Workflow tools write through `gwd_*` APIs.
8. Markdown projections render under `.gwd/`.
9. Headless, web, MCP, VS Code, doctor, worktree, and report surfaces read the same GWD runtime state.

Package metadata flows through the same identity:

1. Manifests declare version `0.0.1`.
2. Lockfiles mirror `0.0.1`.
3. Repository, homepage, bugs, badge, Docker, and native package metadata point at `rayliu-factory/gwd`.
4. Docs and READMEs show `gwd` install and command examples.

There should be no active writes to `.gsd/`, no active lookup of `.gsd/gsd.db`, and no active instruction to run `/gsd` or `gsd`.

## Error Handling

The main error mode is partial rename drift. `npm run audit:gwd-namespace` should be the authoritative detector and should report active old namespace references with file and line number.

Renaming `src/resources/extensions/gsd` can break imports, scripts, and test globs. The implementation should update path references as an early batch, then use TypeScript compile and targeted tests to catch remaining broken imports.

Runtime path mismatch should fail through tests, not compatibility warnings. Bootstrap, doctor, headless query, and web file-root tests should assert `.gwd/gwd.db` and should not report `.gsd/gwd.db` or `.gsd/gsd.db`.

Package skew should be handled by updating manifests and lockfiles together. The final state should not leave `package.json`, package-lock files, VS Code lockfiles, or workspace manifests disagreeing about version or repository identity.

Historical allowlists should be small. If an old namespace reference is not in an explicitly historical file, treat it as a bug.

## Testing

Verification should run in layers:

1. Fast drift gate: `npm run audit:gwd-namespace`.
2. Namespace unit tests: `node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/tests/gwd-namespace.test.ts`.
3. Targeted runtime/state tests for bootstrap, paths, doctor, headless query, web file roots, command parsing, and extension discovery.
4. VS Code package and manifest tests after command-ID changes.
5. Compile and typecheck: `npm run test:compile` and `npm run typecheck:extensions`.
6. Package metadata verification, including lockfile inspection and `npm run validate-pack` where practical.
7. Markdown sanity checks for current README, Markdown, and MDX files: balanced code fences, local links where practical, and `git diff --check`.
8. Broader gate: `npm run verify:pr` once targeted gates pass.

The audit should include `.md` and `.mdx` files because documentation is part of the requested cutover. It should exclude generated output and dependencies.

## Acceptance Criteria

- `gwd` is the active CLI command and `gsd` is absent.
- `/gwd` is the active slash-command prefix and `/gsd` is absent.
- `gwd_*` is the active tool prefix and `gsd_*` tools are absent.
- Runtime state is created and read under `.gwd/` and `~/.gwd/`.
- The runtime database path is `.gwd/gwd.db`.
- `GWD_*` variables are supported and `GSD_*` variables are ignored.
- The bundled workflow extension path and package identity use `gwd`.
- Root and release-bearing package versions are `0.0.1`.
- Active repository metadata points at `rayliu-factory/gwd`.
- VS Code command IDs, settings, views, chat participant, SCM provider, and docs use GWD naming.
- Current README, Markdown, and MDX files describe GWD and active `gwd` commands.
- `npm run audit:gwd-namespace` passes with only documented historical exceptions.
- Targeted namespace, runtime path, compile/typecheck, docs, and package metadata verification pass.
