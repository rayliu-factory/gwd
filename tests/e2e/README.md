# GWD e2e tests

End-to-end tests that spawn the **real built** `gwd` binary as a child process
and exercise it through realistic flows.

These exist to catch regressions that mock-heavy unit/integration tests can't:
real argv parsing, real env handling, real signal/exit behavior, real I/O.

## Running locally

```bash
npm run build:core
chmod +x dist/loader.js
GWD_SMOKE_BINARY="$(pwd)/dist/loader.js" npm run test:e2e
```

If `GWD_SMOKE_BINARY` is not set, the suite falls back to whatever `gwd`
resolves on PATH (matching the convention used by `tests/live-regression`).

### Docker e2e (separate suite)

The Docker runtime smoke is a separate, slower suite. It builds the
`runtime-local` Dockerfile target from a `npm pack` tarball and runs the
binary inside the container.

```bash
npm run test:e2e:docker
```

Skipped automatically if `docker` is not on PATH. CI runs this only on
Docker-relevant changes (Dockerfile, scripts/, package*.json, src/, etc.).

## Writing a new e2e test

1. Create `tests/e2e/<feature>.e2e.test.ts`. The `.e2e.test.ts` suffix is
   what `npm run test:e2e` globs.
2. Use `node:test` + `node:assert/strict`. No Jest, no Vitest.
3. Use `t.after()` for cleanup. Never `try`/`finally`.
4. Import helpers from `./_shared/`:

```ts
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createTmpProject, gwdSync, gwdAsync } from "./_shared/index.ts";

describe("my feature", () => {
  test("does the thing", (t) => {
    const project = createTmpProject({ git: true });
    t.after(project.cleanup);

    const result = gwdSync(["some-command"], { cwd: project.dir });

    assert.equal(result.code, 0);
    assert.match(result.stdoutClean, /expected output/);
  });
});
```

## Harness contracts (`_shared/`)

- **`spawn.ts`** — `gwdSync` / `gwdAsync` wrappers. Both:
  - Resolve `GWD_SMOKE_BINARY` → `node <path>` vs PATH `gwd` automatically.
  - Strip every `GWD_*` env var inherited from the host (prevents local
    config leaking into CI).
  - Set `TMPDIR` to the canonical (realpath) tmpdir to avoid the macOS
    `/var` vs `/private/var` symlink mismatch.
  - Force `GWD_NON_INTERACTIVE=1`.
  - Provide ANSI-stripped output via `result.stdoutClean` / `stderrClean`.
- **`tmp-project.ts`** — `createTmpProject({ git, gwdSkeleton, files })`
  returns `{ dir, cleanup, writeFile }`. Always wire `t.after(cleanup)`.
  `git: true` initializes with `--initial-branch=main` for cross-platform
  determinism.
- **`artifacts.ts`** — `artifactsFor(testSlug)` returns `{ dir, write }`.
  Use it to dump logs/screenshots/traces from a test that's about to fail
  so CI can upload them.

## Anti-patterns to avoid

- ❌ Reading source files and grepping with regex — see "No source-grep
  tests" in [CONTRIBUTING.md](../../CONTRIBUTING.md). E2e is the wrong layer
  for that anyway.
- ❌ Spawning `gwd` directly with `child_process.spawn` — bypasses the
  env-stripping and TMPDIR fix. Always go through `gwdSync` / `gwdAsync`.
- ❌ Asserting on raw ANSI-coded output. Use `result.stdoutClean`.
- ❌ Calling real LLM/network APIs. Future phases land a fake-LLM provider
  that replays scripted transcripts; until then, e2e tests must avoid any
  flow that requires network.

## Status

- ✅ Phase 0 (shared harness)
- ✅ Phase 1a (sanity: `--version`, `--help`, env isolation)
- ✅ Phase 1b (fake-LLM provider + agent loop tests)
- ✅ Phase 2 (real-process MCP server e2e)
- ✅ Phase 6 (native TS↔Rust ABI smoke)
- ✅ Phase 7 (migration smoke)
- ✅ B (docker runtime smoke against current source)
- ✅ D (Windows smoke coverage — non-blocking inside the portability job)
- Dropped: `gwd undo` e2e. Schema rollback is not a shipped feature.
- Dropped: Studio launch-only e2e. Studio is retired from the CI e2e process.

The suite now covers the originally planned shipped CLI/runtime surfaces. Add
new e2e tests when a change needs real process, filesystem, environment,
packaging, or cross-platform coverage that unit and integration tests cannot
prove.

## CI runners

- **`e2e`** (linux) — required gate.
- **`docker-e2e`** (linux) — gated on Docker-relevant change filter.
- **`windows-portability`** (windows) — blocking portability checks plus a
  non-blocking e2e smoke subset for Windows-specific path, TMPDIR, and
  child-process regressions.
