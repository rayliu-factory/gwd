# GWD Namespace Hard Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the active product namespace from GSD to GWD with no compatibility aliases.

**Architecture:** Treat the rename as a product contract cutover, not a blind string replacement. First add an audit harness, then update package identity, central runtime constants, bundled extension paths, command/tool surfaces, VS Code/web surfaces, and current docs. Each chunk ends with an audit and targeted tests so old active `gsd` surfaces do not re-enter.

**Tech Stack:** TypeScript, Node 22, npm workspaces, VS Code extension manifest, Electron/Next.js side packages, GitHub Actions, Docker.

**Spec:** `docs/dev/superpowers/specs/2026-05-10-gwd-namespace-hard-cutover-design.md`

---

## Scope Check

This spec crosses several surfaces, but they are not independent deliverables. Splitting public package identity, runtime state paths, command names, and extension tool names into separately shipped changes would create broken intermediate releases. Keep one implementation plan, but commit after each verified chunk.

## File Structure

### New Files

| File | Responsibility |
| --- | --- |
| `scripts/gwd-namespace-audit.mjs` | Block active old namespace references outside explicit historical allowlist. |
| `src/namespace.ts` | Canonical product namespace constants used by root CLI code. |
| `src/tests/gwd-namespace.test.ts` | Contract tests for CLI/runtime namespace constants and old env rejection. |

### Renamed Files And Directories

| From | To | Responsibility |
| --- | --- | --- |
| `src/resources/extensions/gsd/` | `src/resources/extensions/gwd/` | Bundled workflow extension. |
| `src/resources/extensions/gsd/gsd-db.ts` | `src/resources/extensions/gwd/gwd-db.ts` | Runtime DB module. |
| `src/resources/extensions/gsd/gsd-home.ts` | `src/resources/extensions/gwd/gwd-home.ts` | Home/project-state path helpers. |
| `src/resources/extensions/shared/gsd-phase-state.ts` | `src/resources/extensions/shared/gwd-phase-state.ts` | Shared workflow phase state helper. |
| `src/resources/GSD-WORKFLOW.md` | `src/resources/GWD-WORKFLOW.md` | Bundled workflow file. |
| `packages/native/src/gsd-parser/` | `packages/native/src/gwd-parser/` | Native parser package surface. |
| `native/crates/engine/src/gsd_parser.rs` | `native/crates/engine/src/gwd_parser.rs` | Rust native parser module. |
| `vscode-extension/src/gsd-client.ts` | `vscode-extension/src/gwd-client.ts` | VS Code RPC client. |
| `vscode-extension/src/gsd-client-spawn.ts` | `vscode-extension/src/gwd-client-spawn.ts` | VS Code spawn plan helper. |
| `web/components/gsd/` | `web/components/gwd/` | Web UI components. |
| `web/lib/gsd-workspace-store.tsx` | `web/lib/gwd-workspace-store.tsx` | Web workspace state store. |
| `web/lib/initial-gsd-header-filter.ts` | `web/lib/initial-gwd-header-filter.ts` | Web header filter helper. |

### Modified Files

| File | Change |
| --- | --- |
| `package.json` | Root package, bins, `piConfig`, scripts, Docker image names, workspace dependency names. |
| `package-lock.json` | Lockfile package names and workspace dependency references. |
| `packages/*/package.json` | Workspace names, `gwd` metadata, dependency scopes, binary names. |
| `extensions/google-search/package.json` | Extension package scope, keywords, peer dependency scopes. |
| `pkg/package.json` | Legacy package manifest namespace. |
| `Dockerfile` | Build args, package names, entrypoints, paths. |
| `.github/workflows/*.yml` | Package names, env vars, smoke binary names, path filters, checked state dir. |
| `.github/ISSUE_TEMPLATE/*.yml` | Current issue templates use GWD names and `.gwd` examples. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Current PR checklist and repo URLs use GWD names. |
| `scripts/*.mjs`, `scripts/*.js`, `scripts/*.sh`, `scripts/*.ps1` | Env vars, CLI binary names, state dirs, package names. |
| `src/app-paths.ts` | Global state root moves to `~/.gwd` and `GWD_HOME`. |
| `src/help-text.ts` | CLI help moves from `gsd` to `gwd`. |
| `src/cli.ts` | Env vars, imports, runtime messages, extension import paths. |
| `src/headless.ts` | `/gwd` command generation, `.gwd` bootstrap checks, `GWD_*` env. |
| `src/headless-context.ts` | Bootstrap `.gwd` project structure. |
| `src/rtk-shared.ts`, `src/rtk.ts` | RTK env vars and managed path root. |
| `src/web/**/*.ts` | Web env vars, auth storage key, command dispatch text, package-root env. |
| `src/resources/extensions/gwd/**/*.ts` | Tool names, command names, prompts, env vars, DB filename, imports. |
| `src/resources/extensions/gwd/prompts/**/*.md` | `/gwd`, `.gwd`, `gwd_*`, current guidance. |
| `src/resources/extensions/gwd/tests/**/*.ts` | Test fixtures move to `.gwd`, `GWD_*`, `gwd_*`, and renamed imports. |
| `vscode-extension/package.json` | Name, display name, command IDs, views, config keys, chat participant, default binary. |
| `vscode-extension/src/**/*.ts` | `Gwd*` exported identifiers, `gwd.*` commands, `@gwd`, `/gwd`, binary path. |
| `vscode-extension/README.md`, `vscode-extension/CHANGELOG.md` | Current user instructions use GWD. |
| `README.md`, `VISION.md`, `gitbook/**/*.md`, `mintlify-docs/**/*.mdx`, `docs/**/*.md` | Current install/setup/usage docs use GWD; historical changelog text can remain only when audit allowlisted. |

---

## Task 1: Add Namespace Audit Harness

**Files:**
- Create: `scripts/gwd-namespace-audit.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create the audit script**

```javascript
// scripts/gwd-namespace-audit.mjs
// Fails on active old GSD namespace references after the hard cutover.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

const ignoredDirs = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-test",
  ".next",
  "coverage",
  ".turbo",
  ".cache",
]);

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".dockerignore",
  ".gitignore",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".ps1",
  ".rs",
  ".sh",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);

const activeOldNamespacePatterns = [
  /(^|[^A-Za-z0-9])gsd($|[^A-Za-z0-9])/,
  /GSD_/,
  /\.gsd/,
  /\/gsd/,
  /@gsd/,
  /gsd-pi/,
  /gsd-build/,
  /gsd-2/,
  /Gsd[A-Z]/,
  /\bGSD\b/,
  /Get Shit Done/,
];

const historicalAllowlist = [
  /^CHANGELOG\.md$/,
  /^docs\/dev\/superpowers\/specs\/2026-05-10-gwd-namespace-hard-cutover-design\.md$/,
  /^docs\/dev\/superpowers\/plans\/2026-05-10-gwd-namespace-hard-cutover\.md$/,
  /^docs\/dev\/superpowers\/specs\/2026-03-17-cicd-pipeline-design\.md$/,
  /^docs\/dev\/superpowers\/plans\/2026-03-17-cicd-pipeline\.md$/,
];

function isTextFile(path) {
  return textExtensions.has(path.slice(path.lastIndexOf("."))) || path.endsWith("Dockerfile") || path.includes("/Dockerfile");
}

function isAllowlisted(path) {
  return historicalAllowlist.some((pattern) => pattern.test(path));
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const rel = relative(root, abs).replaceAll("\\", "/");
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      if (!ignoredDirs.has(entry)) yield* walk(abs);
      continue;
    }
    if (stat.isFile() && isTextFile(rel)) yield rel;
  }
}

const failures = [];

for (const rel of walk(root)) {
  if (isAllowlisted(rel)) continue;
  const content = readFileSync(join(root, rel), "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of activeOldNamespacePatterns) {
      if (pattern.test(line)) {
        failures.push(`${rel}:${index + 1}: ${line.trim()}`);
        break;
      }
    }
  });
}

if (failures.length > 0) {
  process.stderr.write(`Old active namespace references found (${failures.length}):\n`);
  process.stderr.write(failures.slice(0, 200).join("\n"));
  if (failures.length > 200) {
    process.stderr.write(`\n...and ${failures.length - 200} more`);
  }
  process.stderr.write("\n");
  process.exit(1);
}

process.stdout.write("GWD namespace audit passed\n");
```

- [ ] **Step 2: Add the audit script to root scripts**

Modify `package.json` scripts to include:

```json
{
  "audit:gwd-namespace": "node scripts/gwd-namespace-audit.mjs"
}
```

- [ ] **Step 3: Run the audit before implementation**

Run: `npm run audit:gwd-namespace`

Expected: FAIL with many active old namespace references. This verifies the audit is capable of catching the current repo state.

- [ ] **Step 4: Commit**

```bash
git add package.json scripts/gwd-namespace-audit.mjs
git commit -m "test: add GWD namespace audit"
```

---

## Task 2: Cut Over Package And Distribution Identity

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `packages/contracts/package.json`
- Modify: `packages/daemon/package.json`
- Modify: `packages/mcp-server/package.json`
- Modify: `packages/native/package.json`
- Modify: `packages/pi-agent-core/package.json`
- Modify: `packages/pi-ai/package.json`
- Modify: `packages/pi-coding-agent/package.json`
- Modify: `packages/pi-tui/package.json`
- Modify: `packages/rpc-client/package.json`
- Modify: `extensions/google-search/package.json`
- Modify: `studio/package.json`
- Modify: `web/package.json`
- Modify: `pkg/package.json`

- [ ] **Step 1: Update root package identity**

Change the top of `package.json` to:

```json
{
  "name": "gwd-pi",
  "version": "2.81.0",
  "description": "GWD — Get Work Done coding agent",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/gwd-build/gwd-2.git"
  },
  "homepage": "https://github.com/gwd-build/gwd-2#readme",
  "bugs": {
    "url": "https://github.com/gwd-build/gwd-2/issues"
  },
  "type": "module",
  "workspaces": [
    "packages/*",
    "extensions/*"
  ],
  "bin": {
    "gwd": "dist/loader.js",
    "gwd-pi": "scripts/install.js"
  },
  "piConfig": {
    "name": "gwd",
    "configDir": ".gwd"
  }
}
```

Keep the existing fields not shown in this snippet.

- [ ] **Step 2: Update workspace package identities**

Apply this exact package-name mapping in every workspace manifest and dependency list:

```text
@gsd/pi-tui -> @gwd/pi-tui
@gsd/pi-ai -> @gwd/pi-ai
@gsd/pi-agent-core -> @gwd/pi-agent-core
@gsd/pi-coding-agent -> @gwd/pi-coding-agent
@gsd/native -> @gwd/native
@gsd/studio -> @gwd/studio
@gsd-build/contracts -> @gwd-build/contracts
@gsd-build/rpc-client -> @gwd-build/rpc-client
@gsd-build/mcp-server -> @gwd-build/mcp-server
@gsd-build/daemon -> @gwd-build/daemon
@gsd-extensions/google-search -> @gwd-extensions/google-search
@glittercowboy/gsd -> @glittercowboy/gwd
gsd-web -> gwd-web
```

- [ ] **Step 3: Update package metadata keys**

In every `package.json`, rename metadata key `"gsd"` to `"gwd"` and update nested scope values:

```json
{
  "gwd": {
    "linkable": true,
    "scope": "@gwd-build",
    "name": "contracts"
  }
}
```

Use `@gwd` for vendored `pi-*` packages and `@gwd-build` for `contracts`, `rpc-client`, `mcp-server`, and `daemon`.

- [ ] **Step 4: Update public binary names**

Use these binary mappings:

```text
gsd -> gwd
gsd-pi -> gwd-pi
gsd-mcp-server -> gwd-mcp-server
gsd-daemon -> gwd-daemon
```

Remove `gsd-cli` from root `bin`; do not add a `gwd-cli` alias unless a test fails because a distinct CLI binary is required.

- [ ] **Step 5: Refresh the lockfile**

Run: `npm install --package-lock-only --ignore-scripts`

Expected: `package-lock.json` updates package names, workspace dependency keys, and file workspace references without installing or running package lifecycle scripts.

- [ ] **Step 6: Verify package metadata**

Run:

```bash
node -e "const p=require('./package.json'); if (p.name !== 'gwd-pi') throw new Error(p.name); if (p.bin.gsd) throw new Error('old gsd bin still exposed'); if (!p.bin.gwd) throw new Error('missing gwd bin'); console.log('root package ok')"
```

Expected: `root package ok`

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json packages/*/package.json extensions/google-search/package.json studio/package.json web/package.json pkg/package.json
git commit -m "build: rename packages to GWD namespace"
```

---

## Task 3: Add Canonical Namespace Constants

**Files:**
- Create: `src/namespace.ts`
- Create: `src/tests/gwd-namespace.test.ts`
- Modify: `src/app-paths.ts`
- Modify: `src/help-text.ts`
- Modify: `src/rtk-shared.ts`
- Modify: `src/rtk.ts`
- Modify: `src/update-cmd.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Add root namespace constants**

```typescript
// src/namespace.ts
export const PRODUCT_SHORT_NAME = "gwd";
export const PRODUCT_DISPLAY_NAME = "GWD";
export const PRODUCT_FULL_NAME = "Get Work Done";
export const PRODUCT_PACKAGE_NAME = "gwd-pi";
export const GLOBAL_STATE_DIR_NAME = ".gwd";
export const PROJECT_STATE_DIR_NAME = ".gwd";
export const RUNTIME_DB_FILE_NAME = "gwd.db";
export const ENV_PREFIX = "GWD";
export const CLI_COMMAND = "gwd";
export const SLASH_COMMAND_PREFIX = "/gwd";
export const TOOL_PREFIX = "gwd_";

export const GWD_HOME_ENV = "GWD_HOME";
export const GWD_BIN_PATH_ENV = "GWD_BIN_PATH";
export const GWD_VERSION_ENV = "GWD_VERSION";
export const GWD_HEADLESS_ENV = "GWD_HEADLESS";
export const GWD_RTK_DISABLED_ENV = "GWD_RTK_DISABLED";
export const GWD_RTK_PATH_ENV = "GWD_RTK_PATH";
export const GWD_SKIP_RTK_INSTALL_ENV = "GWD_SKIP_RTK_INSTALL";
```

- [ ] **Step 2: Update global app paths**

Make `src/app-paths.ts` read:

```typescript
import { homedir } from "os";
import { join } from "path";
import { GLOBAL_STATE_DIR_NAME, GWD_HOME_ENV } from "./namespace.js";

export const appRoot = process.env[GWD_HOME_ENV] || join(homedir(), GLOBAL_STATE_DIR_NAME);
export const agentDir = join(appRoot, "agent");
export const sessionsDir = join(appRoot, "sessions");
export const authFilePath = join(agentDir, "auth.json");
export const webPidFilePath = join(appRoot, "web-server.pid");
export const webPreferencesPath = join(appRoot, "web-preferences.json");
```

- [ ] **Step 3: Update CLI help text**

In `src/help-text.ts`, change the banner and examples so `printHelp("2.81.0")` starts with:

```text
GWD v2.81.0 — Get Work Done
```

Every usage line in this file should use `gwd`, not `gsd`, and every slash-command example should use `/gwd`.

- [ ] **Step 4: Update RTK env constants**

In `src/rtk-shared.ts`, replace exported env constants with imports from `src/namespace.ts`:

```typescript
import { homedir as osHomedir } from "os";
import { join } from "path";
import { GLOBAL_STATE_DIR_NAME, GWD_HOME_ENV, GWD_RTK_DISABLED_ENV, GWD_RTK_PATH_ENV } from "./namespace.js";

export { GWD_RTK_DISABLED_ENV, GWD_RTK_PATH_ENV };

export function isTruthy(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

export function shouldEnableRtk(env: NodeJS.ProcessEnv = process.env): boolean {
  return !isTruthy(env[GWD_RTK_DISABLED_ENV]);
}

export function getManagedRtkBinDir(env: NodeJS.ProcessEnv = process.env): string {
  return join(env[GWD_HOME_ENV] || join(osHomedir(), GLOBAL_STATE_DIR_NAME), "agent", "bin");
}
```

- [ ] **Step 5: Update version and RTK reads**

In `src/cli.ts`, `src/update-cmd.ts`, and `src/rtk.ts`, use `GWD_VERSION_ENV`, `GWD_RTK_DISABLED_ENV`, `GWD_RTK_PATH_ENV`, and `GWD_SKIP_RTK_INSTALL_ENV`. Do not read `GSD_VERSION`, `GSD_RTK_DISABLED`, `GSD_RTK_PATH`, or `GSD_SKIP_RTK_INSTALL`.

- [ ] **Step 6: Write namespace contract tests**

```typescript
// src/tests/gwd-namespace.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  CLI_COMMAND,
  GLOBAL_STATE_DIR_NAME,
  GWD_HOME_ENV,
  PROJECT_STATE_DIR_NAME,
  RUNTIME_DB_FILE_NAME,
  SLASH_COMMAND_PREFIX,
  TOOL_PREFIX,
} from "../namespace.ts";

test("namespace constants use the GWD hard-cutover values", () => {
  assert.equal(CLI_COMMAND, "gwd");
  assert.equal(GLOBAL_STATE_DIR_NAME, ".gwd");
  assert.equal(PROJECT_STATE_DIR_NAME, ".gwd");
  assert.equal(RUNTIME_DB_FILE_NAME, "gwd.db");
  assert.equal(SLASH_COMMAND_PREFIX, "/gwd");
  assert.equal(TOOL_PREFIX, "gwd_");
});

test("app paths honor GWD_HOME and ignore GSD_HOME", async () => {
  const oldGwdHome = process.env.GWD_HOME;
  const oldGsdHome = process.env.GSD_HOME;
  const moduleUrl = `../app-paths.ts?case=${Date.now()}`;

  try {
    process.env.GWD_HOME = "/tmp/gwd-home";
    process.env.GSD_HOME = "/tmp/old-gsd-home";
    const paths = await import(moduleUrl);
    assert.equal(paths.appRoot, "/tmp/gwd-home");
    assert.equal(paths.agentDir, join("/tmp/gwd-home", "agent"));
  } finally {
    if (oldGwdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = oldGwdHome;
    if (oldGsdHome === undefined) delete process.env.GSD_HOME;
    else process.env.GSD_HOME = oldGsdHome;
  }
});

test("default app path uses ~/.gwd", async () => {
  const oldGwdHome = process.env.GWD_HOME;
  const oldGsdHome = process.env.GSD_HOME;
  const moduleUrl = `../app-paths.ts?case=${Date.now()}-default`;

  try {
    delete process.env.GWD_HOME;
    process.env.GSD_HOME = "/tmp/old-gsd-home";
    const paths = await import(moduleUrl);
    assert.equal(paths.appRoot, join(homedir(), ".gwd"));
  } finally {
    if (oldGwdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = oldGwdHome;
    if (oldGsdHome === undefined) delete process.env.GSD_HOME;
    else process.env.GSD_HOME = oldGsdHome;
  }
});
```

- [ ] **Step 7: Run targeted namespace tests**

Run:

```bash
node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/tests/gwd-namespace.test.ts
```

Expected before Task 4 path rename: PASS. The resolver path still uses `gsd` in this task because the bundled extension directory has not moved yet.

- [ ] **Step 8: Commit**

```bash
git add src/namespace.ts src/tests/gwd-namespace.test.ts src/app-paths.ts src/help-text.ts src/rtk-shared.ts src/rtk.ts src/update-cmd.ts src/cli.ts
git commit -m "feat: add GWD namespace constants"
```

---

## Task 4: Rename Bundled Extension And Resource Paths

**Files:**
- Rename: `src/resources/extensions/gsd/` to `src/resources/extensions/gwd/`
- Rename: `src/resources/extensions/gsd/gsd-db.ts` to `src/resources/extensions/gwd/gwd-db.ts`
- Rename: `src/resources/extensions/gsd/gsd-home.ts` to `src/resources/extensions/gwd/gwd-home.ts`
- Rename: `src/resources/extensions/shared/gsd-phase-state.ts` to `src/resources/extensions/shared/gwd-phase-state.ts`
- Rename: `src/resources/GSD-WORKFLOW.md` to `src/resources/GWD-WORKFLOW.md`
- Modify: `src/bundled-extension-paths.ts`
- Modify: `src/bundled-resource-path.ts`
- Modify: `src/resource-loader.ts`
- Modify: `src/loader.ts`
- Modify: `src/headless.ts`
- Modify: `src/headless-context.ts`
- Modify: `src/tests/bundled-extension-paths.test.ts`
- Modify: `src/tests/bundled-resource-path.test.ts`
- Modify: `scripts/copy-resources.cjs`
- Modify: `scripts/dist-test-resolve.mjs`

- [ ] **Step 1: Move resource paths with git**

```bash
git mv src/resources/extensions/gsd src/resources/extensions/gwd
git mv src/resources/extensions/gwd/gsd-db.ts src/resources/extensions/gwd/gwd-db.ts
git mv src/resources/extensions/gwd/gsd-home.ts src/resources/extensions/gwd/gwd-home.ts
git mv src/resources/extensions/shared/gsd-phase-state.ts src/resources/extensions/shared/gwd-phase-state.ts
git mv src/resources/GSD-WORKFLOW.md src/resources/GWD-WORKFLOW.md
```

- [ ] **Step 2: Update import paths**

Replace these import path fragments in `src/**`, `scripts/**`, `packages/**`, `web/**`, and `vscode-extension/**`:

```text
resources/extensions/gsd -> resources/extensions/gwd
extensions/gsd -> extensions/gwd
../gsd-db -> ../gwd-db
./gsd-db -> ./gwd-db
../gsd-home -> ../gwd-home
./gsd-home -> ./gwd-home
shared/gsd-phase-state -> shared/gwd-phase-state
GSD-WORKFLOW.md -> GWD-WORKFLOW.md
```

- [ ] **Step 3: Update headless bootstrap path code**

In `src/headless-context.ts`, rename the function and `.gwd` directory:

```typescript
export function bootstrapGwdProject(basePath: string): void {
  const gwdDir = join(basePath, ".gwd");
  mkdirSync(join(gwdDir, "milestones"), { recursive: true });
  mkdirSync(join(gwdDir, "runtime"), { recursive: true });
}
```

Update `src/headless.ts` to import `bootstrapGwdProject` and validate `.gwd`.

- [ ] **Step 4: Update runtime DB filename**

In the renamed `src/resources/extensions/gwd/gwd-db.ts`, make the database path use `gwd.db`:

```typescript
const DB_FILENAME = "gwd.db";
```

If the file currently has inline string literals instead of a constant, introduce this constant near the top and replace every active `"gsd.db"` path construction in that module with `DB_FILENAME`.

- [ ] **Step 5: Run moved-path tests**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/tests/bundled-extension-paths.test.ts src/tests/bundled-resource-path.test.ts src/tests/gwd-namespace.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src scripts packages web vscode-extension
git commit -m "refactor: move bundled extension to GWD paths"
```

---

## Task 5: Cut Over Command, Tool, Env, And Prompt Names

**Files:**
- Modify: `src/headless.ts`
- Modify: `src/cli-web-branch.ts`
- Modify: `src/web-mode.ts`
- Modify: `src/web/**/*.ts`
- Modify: `src/resources/extensions/gwd/**/*.ts`
- Modify: `src/resources/extensions/gwd/prompts/**/*.md`
- Modify: `src/resources/extensions/gwd/tests/**/*.ts`
- Modify: `packages/mcp-server/src/**/*.ts`
- Modify: `packages/daemon/src/**/*.ts`
- Modify: `scripts/**/*.mjs`
- Modify: `scripts/**/*.js`
- Modify: `scripts/**/*.sh`
- Modify: `scripts/**/*.ps1`

- [ ] **Step 1: Apply active namespace token map**

Use this token map for active runtime code, prompts, and tests:

```text
GSD_ -> GWD_
GSD -> GWD
Gsd -> Gwd
gsd_ -> gwd_
gsd- -> gwd-
gsd. -> gwd.
gsd/ -> gwd/
/gsd -> /gwd
.gsd -> .gwd
gsd.db -> gwd.db
gsd_exec -> gwd_exec
gsd_exec_search -> gwd_exec_search
gsd_resume -> gwd_resume
gsd_summary_save -> gwd_summary_save
gsd_requirement_save -> gwd_requirement_save
gsd_milestone_status -> gwd_milestone_status
gsd_task_complete -> gwd_task_complete
gsd_validate_milestone -> gwd_validate_milestone
```

Do not preserve aliases for old names.

- [ ] **Step 2: Update CLI/headless command generation**

In `src/headless.ts`, command construction should become:

```typescript
process.stderr.write(`[headless] Running /gwd ${options.command}${options.commandArgs.length > 0 ? " " + options.commandArgs.join(" ") : ""}...\n`);
const command = `/gwd ${options.command}${options.commandArgs.length > 0 ? " " + options.commandArgs.join(" ") : ""}`;
```

The auto chaining prompt should become:

```typescript
await client.prompt("/gwd auto");
```

- [ ] **Step 3: Update workflow MCP environment variables**

In workflow MCP launch code and tests, use these env names:

```text
GWD_WORKFLOW_MCP_NAME
GWD_WORKFLOW_MCP_COMMAND
GWD_WORKFLOW_MCP_ARGS
GWD_WORKFLOW_MCP_ENV
GWD_WORKFLOW_MCP_CWD
GWD_CLI_PATH
GWD_BIN_PATH
GWD_PERSIST_WRITE_GATE_STATE
GWD_WORKFLOW_PROJECT_ROOT
GWD_WORKFLOW_EXECUTORS_MODULE
GWD_WORKFLOW_WRITE_GATE_MODULE
```

- [ ] **Step 4: Update web-mode environment variables**

Use these web env names:

```text
GWD_WEB_AUTH_TOKEN
GWD_WEB_HOST
GWD_WEB_PORT
GWD_WEB_ALLOWED_ORIGINS
GWD_WEB_DAEMON_MODE
GWD_WEB_PROJECT_CWD
GWD_WEB_PACKAGE_ROOT
GWD_WEB_HOST_KIND
GWD_WEB_PTY
NEXT_PUBLIC_GWD_DEV
```

- [ ] **Step 5: Update prompt and tool catalog names**

After token replacement, run:

```bash
rg -n 'gsd_|/gsd|\.gsd|GSD_|Gsd[A-Z]|@gsd|gsd-pi|gsd-build' src/resources/extensions/gwd packages/mcp-server src/web scripts
```

Expected: no output except explicit negative tests proving old names are rejected.

- [ ] **Step 6: Run command/tool tests**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/gsd-tools.test.ts src/resources/extensions/gwd/tests/workflow-mcp.test.ts src/tests/headless-cli-surface.test.ts src/tests/web-mode-cli.test.ts
```

Expected: initial path names may still include `gsd` in test filenames until Task 6; test assertions must use GWD names and pass.

- [ ] **Step 7: Commit**

```bash
git add src packages scripts web
git commit -m "refactor: rename runtime commands and tools to GWD"
```

---

## Task 6: Rename Test Filenames And Native Parser Surfaces

**Files:**
- Rename: `packages/native/src/gsd-parser/` to `packages/native/src/gwd-parser/`
- Rename: `native/crates/engine/src/gsd_parser.rs` to `native/crates/engine/src/gwd_parser.rs`
- Rename: `src/tests/create-gsd-extension-paths.test.ts` to `src/tests/create-gwd-extension-paths.test.ts`
- Rename: `src/tests/gsd-web-launcher-contract.test.ts` to `src/tests/gwd-web-launcher-contract.test.ts`
- Rename: `src/tests/initial-gsd-header-filter.test.ts` to `src/tests/initial-gwd-header-filter.test.ts`
- Rename: `src/resources/extensions/gwd/tests/gsd-db*.test.ts` to `src/resources/extensions/gwd/tests/gwd-db*.test.ts`
- Rename: `src/resources/extensions/gwd/tests/gsd-home.test.ts` to `src/resources/extensions/gwd/tests/gwd-home.test.ts`
- Rename: `src/resources/extensions/gwd/tests/gsd-tools.test.ts` to `src/resources/extensions/gwd/tests/gwd-tools.test.ts`
- Rename: `src/resources/extensions/gwd/tests/*gsd*.test.ts` to matching `*gwd*.test.ts`

- [ ] **Step 1: Rename known parser surfaces**

```bash
git mv packages/native/src/gsd-parser packages/native/src/gwd-parser
git mv native/crates/engine/src/gsd_parser.rs native/crates/engine/src/gwd_parser.rs
```

- [ ] **Step 2: Rename top-level test files**

```bash
git mv src/tests/create-gsd-extension-paths.test.ts src/tests/create-gwd-extension-paths.test.ts
git mv src/tests/gsd-web-launcher-contract.test.ts src/tests/gwd-web-launcher-contract.test.ts
git mv src/tests/initial-gsd-header-filter.test.ts src/tests/initial-gwd-header-filter.test.ts
```

- [ ] **Step 3: Rename bundled extension test files**

Run:

```bash
find src/resources/extensions/gwd/tests -name '*gsd*' -print
```

For each file printed, rename `gsd` to `gwd` in the basename using `git mv`. Example:

```bash
git mv src/resources/extensions/gwd/tests/gsd-db.test.ts src/resources/extensions/gwd/tests/gwd-db.test.ts
```

Expected after renames:

```bash
find src/resources/extensions/gwd/tests -name '*gsd*' -print
```

prints nothing.

- [ ] **Step 4: Update native exports**

In `packages/native/package.json`, change the export from `./gsd-parser` to:

```json
"./gwd-parser": {
  "types": "./dist/gwd-parser/index.d.ts",
  "default": "./dist/gwd-parser/index.js"
}
```

Update imports that used `@gwd/native/gsd-parser` to `@gwd/native/gwd-parser`.

- [ ] **Step 5: Run native and renamed test path checks**

Run:

```bash
npm run build:native-pkg
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/tests/create-gwd-extension-paths.test.ts src/tests/gwd-web-launcher-contract.test.ts src/tests/initial-gwd-header-filter.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add native packages src
git commit -m "refactor: rename parser and tests to GWD"
```

---

## Task 7: Cut Over VS Code Extension Surface

**Files:**
- Modify: `vscode-extension/package.json`
- Rename: `vscode-extension/src/gsd-client.ts` to `vscode-extension/src/gwd-client.ts`
- Rename: `vscode-extension/src/gsd-client-spawn.ts` to `vscode-extension/src/gwd-client-spawn.ts`
- Modify: `vscode-extension/src/**/*.ts`
- Modify: `vscode-extension/test/**/*.ts`
- Modify: `vscode-extension/README.md`
- Modify: `vscode-extension/CHANGELOG.md`

- [ ] **Step 1: Rename VS Code client files**

```bash
git mv vscode-extension/src/gsd-client.ts vscode-extension/src/gwd-client.ts
git mv vscode-extension/src/gsd-client-spawn.ts vscode-extension/src/gwd-client-spawn.ts
```

- [ ] **Step 2: Update manifest identity**

In `vscode-extension/package.json`, set:

```json
{
  "name": "gwd-2",
  "displayName": "GWD-2",
  "description": "VS Code integration for the GWD-2 coding agent — sidebar dashboard, @gwd chat participant, activity feed, conversation history, code lens, session forking, slash command completion, workflow controls, and 33 commands",
  "repository": {
    "type": "git",
    "url": "https://github.com/gwd-build/gwd-2"
  },
  "homepage": "https://github.com/gwd-build/gwd-2/blob/main/vscode-extension/README.md",
  "bugs": {
    "url": "https://github.com/gwd-build/gwd-2/issues"
  },
  "keywords": ["ai", "agent", "coding", "gwd", "chat", "automation", "claude", "openai", "llm"]
}
```

Keep unchanged manifest fields not shown.

- [ ] **Step 3: Update VS Code command IDs and settings**

Use this mapping across the manifest and source:

```text
gsd.start -> gwd.start
gsd.stop -> gwd.stop
gsd.newSession -> gwd.newSession
gsd.sendMessage -> gwd.sendMessage
gsd.cycleModel -> gwd.cycleModel
gsd.cycleThinking -> gwd.cycleThinking
gsd.compact -> gwd.compact
gsd.abort -> gwd.abort
gsd.exportHtml -> gwd.exportHtml
gsd.sessionStats -> gwd.sessionStats
gsd.runBash -> gwd.runBash
gsd.switchModel -> gwd.switchModel
gsd.setThinking -> gwd.setThinking
gsd.steer -> gwd.steer
gsd.listCommands -> gwd.listCommands
gsd.toggleAutoRetry -> gwd.toggleAutoRetry
gsd.abortRetry -> gwd.abortRetry
gsd.setSessionName -> gwd.setSessionName
gsd.copyLastResponse -> gwd.copyLastResponse
gsd.switchSession -> gwd.switchSession
gsd.refreshSessions -> gwd.refreshSessions
gsd.clearFileDecorations -> gwd.clearFileDecorations
gsd.showHistory -> gwd.showHistory
gsd.askAboutSymbol -> gwd.askAboutSymbol
gsd.clearActivity -> gwd.clearActivity
gsd.forkSession -> gwd.forkSession
gsd.toggleSteeringMode -> gwd.toggleSteeringMode
gsd.toggleFollowUpMode -> gwd.toggleFollowUpMode
gsd.refactorSymbol -> gwd.refactorSymbol
gsd.findBugsSymbol -> gwd.findBugsSymbol
gsd.generateTestsSymbol -> gwd.generateTestsSymbol
gsd.acceptAllChanges -> gwd.acceptAllChanges
gsd.discardAllChanges -> gwd.discardAllChanges
gsd.acceptFileChanges -> gwd.acceptFileChanges
gsd.discardFileChanges -> gwd.discardFileChanges
gsd.restoreCheckpoint -> gwd.restoreCheckpoint
gsd.fixProblemsInFile -> gwd.fixProblemsInFile
gsd.fixAllProblems -> gwd.fixAllProblems
gsd.clearDiagnostics -> gwd.clearDiagnostics
gsd.commitAgentChanges -> gwd.commitAgentChanges
gsd.createAgentBranch -> gwd.createAgentBranch
gsd.showAgentDiff -> gwd.showAgentDiff
gsd.clearPlan -> gwd.clearPlan
gsd.cycleApprovalMode -> gwd.cycleApprovalMode
gsd.selectApprovalMode -> gwd.selectApprovalMode
```

Also change settings from `gsd.*` to `gwd.*`, default binary path from `gsd` to `gwd`, view IDs from `gsd-*` to `gwd-*`, SCM provider from `gsd` to `gwd`, URI scheme from `gsd-original` to `gwd-original`, and chat participant from `gsd.agent` / `@gsd` to `gwd.agent` / `@gwd`.

- [ ] **Step 4: Rename exported VS Code classes and types**

Use these exported identifier mappings:

```text
GsdClient -> GwdClient
GsdClientSpawnPlan -> GwdClientSpawnPlan
GsdSidebarProvider -> GwdSidebarProvider
GsdFileDecorationProvider -> GwdFileDecorationProvider
GsdActivityFeedProvider -> GwdActivityFeedProvider
GsdConversationHistoryPanel -> GwdConversationHistoryPanel
GsdChangeTracker -> GwdChangeTracker
GsdScmProvider -> GwdScmProvider
GsdCodeLensProvider -> GwdCodeLensProvider
GsdDiagnosticBridge -> GwdDiagnosticBridge
GsdSlashCompletionProvider -> GwdSlashCompletionProvider
GsdSessionTreeProvider -> GwdSessionTreeProvider
GsdBashTerminal -> GwdBashTerminal
GsdPlanViewerProvider -> GwdPlanViewerProvider
GsdCheckpointProvider -> GwdCheckpointProvider
GsdLineDecorationManager -> GwdLineDecorationManager
GsdGitIntegration -> GwdGitIntegration
GsdPermissionManager -> GwdPermissionManager
```

- [ ] **Step 5: Run VS Code checks**

Run:

```bash
npm run test:compile
npm run test -w vscode-extension
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add vscode-extension
git commit -m "refactor: rename VS Code extension to GWD"
```

---

## Task 8: Cut Over Web, Studio, Docker, CI, And Current Docs

**Files:**
- Rename: `web/components/gsd/` to `web/components/gwd/`
- Rename: `web/lib/gsd-workspace-store.tsx` to `web/lib/gwd-workspace-store.tsx`
- Rename: `web/lib/initial-gsd-header-filter.ts` to `web/lib/initial-gwd-header-filter.ts`
- Modify: `web/**/*.ts`
- Modify: `web/**/*.tsx`
- Modify: `studio/**/*.ts`
- Modify: `studio/**/*.tsx`
- Modify: `Dockerfile`
- Modify: `.github/workflows/*.yml`
- Modify: `.github/ISSUE_TEMPLATE/*.yml`
- Modify: `.github/PULL_REQUEST_TEMPLATE.md`
- Modify: `README.md`
- Modify: `VISION.md`
- Modify: `docs/**/*.md`
- Modify: `gitbook/**/*.md`
- Modify: `mintlify-docs/**/*.mdx`

- [ ] **Step 1: Rename web files**

```bash
git mv web/components/gsd web/components/gwd
git mv web/lib/gsd-workspace-store.tsx web/lib/gwd-workspace-store.tsx
git mv web/lib/initial-gsd-header-filter.ts web/lib/initial-gwd-header-filter.ts
```

- [ ] **Step 2: Update web command dispatch text**

In `web/lib/browser-slash-command-dispatch.ts`, rename constants to `GWD_SURFACE_SUBCOMMANDS`, `GWD_PASSTHROUGH_SUBCOMMANDS`, and `GWD_HELP_TEXT`. The help text must start with:

```text
Available /gwd subcommands:
```

- [ ] **Step 3: Update Dockerfile**

Update Docker naming to:

```dockerfile
# Image: ghcr.io/gwd-build/gwd-pi
ARG GWD_VERSION=latest
RUN npm install -g gwd-pi@${GWD_VERSION}
ENTRYPOINT ["gwd"]
```

For the local tarball stage, use `/tmp/gwd-pi.tgz`, `/usr/local/lib/node_modules/gwd-pi`, and `node /usr/local/lib/node_modules/gwd-pi/dist/loader.js --version`.

- [ ] **Step 4: Update workflows**

Use this CI/workflow mapping:

```text
GSD_SMOKE_BINARY -> GWD_SMOKE_BINARY
GSD_SKIP_RTK_INSTALL -> GWD_SKIP_RTK_INSTALL
GSD_LIVE_TESTS -> GWD_LIVE_TESTS
PACKAGE="gsd-pi" -> PACKAGE="gwd-pi"
which gsd -> which gwd
.gsd -> .gwd
src/resources/extensions/gsd -> src/resources/extensions/gwd
ghcr.io/gsd-build/gsd-pi -> ghcr.io/gwd-build/gwd-pi
```

- [ ] **Step 5: Update current docs**

Update current install/setup/usage instructions in `README.md`, `VISION.md`, `gitbook/`, `mintlify-docs/`, `.github/ISSUE_TEMPLATE/`, and `vscode-extension/README.md` to use:

```text
GWD
Get Work Done
npm install -g gwd-pi
gwd
/gwd
.gwd
~/.gwd
GWD_*
gwd-build/gwd-2
```

Leave old names only in historical changelog entries or the approved spec/plan files.

- [ ] **Step 6: Run web and workflow static checks**

Run:

```bash
npm --prefix web test
npm --prefix studio test
npm run audit:gwd-namespace
```

Expected: web and studio tests pass. Namespace audit may still fail only on historical docs if the allowlist is incomplete; add historical-only paths to `historicalAllowlist` and rerun until the audit passes.

- [ ] **Step 7: Commit**

```bash
git add web studio Dockerfile .github README.md VISION.md docs gitbook mintlify-docs scripts/gwd-namespace-audit.mjs
git commit -m "docs: cut over current guidance to GWD"
```

---

## Task 9: Final Build, Audit, And Regression Pass

**Files:**
- Modify only files required to fix failures from this task.

- [ ] **Step 1: Run final active old-namespace audit**

Run: `npm run audit:gwd-namespace`

Expected: `GWD namespace audit passed`.

- [ ] **Step 2: Run package and TypeScript builds**

Run:

```bash
npm run build:contracts
npm run build:pi
npm run build:mcp-server
npm run typecheck:extensions
```

Expected: each command exits 0.

- [ ] **Step 3: Run unit tests**

Run:

```bash
npm run test:unit
```

Expected: PASS. If this is too slow for the local environment, run the narrow replacement set and record the skipped broader check in the final handoff:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/tests/gwd-namespace.test.ts src/tests/headless-cli-surface.test.ts src/tests/bundled-extension-paths.test.ts src/tests/bundled-resource-path.test.ts
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/gwd-tools.test.ts src/resources/extensions/gwd/tests/workflow-mcp.test.ts
```

- [ ] **Step 4: Verify package bins**

Run:

```bash
npm pack --dry-run
node -e "const p=require('./package.json'); if (!p.bin.gwd) throw new Error('missing gwd bin'); if ('gsd' in p.bin || 'gsd-cli' in p.bin || 'gsd-pi' in p.bin) throw new Error('old bin exposed'); console.log(p.name, Object.keys(p.bin).join(','))"
```

Expected: prints `gwd-pi gwd,gwd-pi` and no old bin names.

- [ ] **Step 5: Final source scan**

Run:

```bash
rg -n 'GSD_|\.gsd|/gsd|@gsd|gsd-pi|gsd-build|gsd-2|Gsd[A-Z]|\bGSD\b|Get Shit Done|(^|[^A-Za-z0-9])gsd($|[^A-Za-z0-9])' --glob '!CHANGELOG.md' --glob '!docs/dev/superpowers/specs/2026-05-10-gwd-namespace-hard-cutover-design.md' --glob '!docs/dev/superpowers/plans/2026-05-10-gwd-namespace-hard-cutover.md'
```

Expected: no active product references. If output contains historical docs, either rewrite the current-use sentence or add that file to the audit allowlist only when the reference is release history.

- [ ] **Step 6: Commit final fixes**

```bash
git add .
git commit -m "chore: complete GWD namespace hard cutover"
```

If there are no changes after verification, skip this commit and record that the prior chunk commits already contain the complete cutover.

---

## Execution Notes

- Use a feature branch or worktree before Task 1 because this plan touches most of the repository.
- Do not add `gsd` compatibility aliases while fixing tests. A failing test that expects `gsd` should be updated to expect `gwd` or to assert that the old surface is absent.
- Historical references are allowed only in release history and the approved spec/plan. Current instructions, examples, tests, package metadata, code paths, prompts, and workflow templates must use GWD.
- If `npm install --package-lock-only --ignore-scripts` needs network and fails in the sandbox, rerun with approved network escalation rather than hand-editing the lockfile.
- If a verification command cannot run because dependencies are missing, run `npm install --ignore-scripts` first. If install is blocked by network, report the exact blocker and do not claim verification.
