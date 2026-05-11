# GWD Independent Initial Release Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the strict GSD-to-GWD namespace cutover as an independent `0.0.1` initial release.

**Architecture:** Treat this as a release identity cutover, not a compatibility migration. The implementation renames active package, runtime, extension, command, VS Code, test, and documentation surfaces to GWD; old GSD names survive only in explicit historical allowlists used by the namespace audit.

**Tech Stack:** TypeScript, Node 22, npm workspaces, Node test runner, VS Code extension manifest, Next.js web app, GitHub Actions, Docker, Markdown/MDX docs.

**Spec:** `docs/dev/superpowers/specs/2026-05-12-gwd-independent-initial-release-cutover-design.md`

---

## Scope Check

The spec spans package metadata, runtime state, extension paths, command surfaces, VS Code, tests, CI, Docker, and docs. These are coupled because partial release identity changes would create a broken product: docs would advertise commands the runtime does not expose, tests would assert paths that code does not create, and package metadata would point at the wrong repository. Keep one implementation plan with separate verified commits.

## File Structure

### Primary Directories To Rename

| From | To | Responsibility |
| --- | --- | --- |
| `src/resources/extensions/gsd/` | `src/resources/extensions/gwd/` | Core bundled workflow extension. |
| `gsd-orchestrator/` | `gwd-orchestrator/` | Workflow/orchestrator skill resources shipped in the repo. |

### Important Files To Rename

| From | To | Responsibility |
| --- | --- | --- |
| `src/resources/GSD-WORKFLOW.md` | `src/resources/GWD-WORKFLOW.md` | Manual workflow bootstrap guide. |
| `src/resources/extensions/gwd/gsd-db.ts` | `src/resources/extensions/gwd/gwd-db.ts` | Runtime database module after directory rename. |
| `src/resources/extensions/gwd/gsd-home.ts` | `src/resources/extensions/gwd/gwd-home.ts` | Home/state path helpers after directory rename. |
| `vscode-extension/src/gsd-client.ts` | `vscode-extension/src/gwd-client.ts` | VS Code RPC client. |
| `vscode-extension/src/gsd-client-spawn.ts` | `vscode-extension/src/gwd-client-spawn.ts` | VS Code process spawn helper. |

### Primary Files To Modify

| File | Responsibility |
| --- | --- |
| `src/namespace.ts` | Canonical GWD constants for product names, state dirs, env vars, CLI, slash commands, and tool prefix. |
| `scripts/gwd-namespace-audit.mjs` | Active old-namespace drift gate with explicit historical allowlist. |
| `package.json`, `package-lock.json` | Root release identity, version `0.0.1`, scripts, bins, workspace references, package lock metadata. |
| `packages/*/package.json`, `native/npm/*/package.json`, `pkg/package.json`, `web/package.json`, `studio/package.json`, `vscode-extension/package.json`, `vscode-extension/package-lock.json` | Workspace release identity, versions, repository URLs, binary names, VS Code contribution IDs. |
| `.github/workflows/*.yml`, `.github/ISSUE_TEMPLATE/*.yml`, `.github/PULL_REQUEST_TEMPLATE.md` | CI paths, native artifact names, issue examples, and PR guidance. |
| `docker/*` | Docker user, state volume, image names, install commands, health checks. |
| `src/**/*.ts`, `src/**/*.md`, `src/**/*.json` | Runtime paths, imports, command text, prompts, tests, resource manifests. |
| `web/**/*` | Web API root identifiers, component imports, displayed product names, command dispatch text. |
| `vscode-extension/**/*` | VS Code command IDs, settings, view IDs, chat participant, classes, tests, README. |
| `README.md`, `VISION.md`, `CONTRIBUTING.md`, `docs/**/*.md`, `gitbook/**/*.md`, `mintlify-docs/**/*.mdx`, `tests/e2e/README.md`, `packages/**/README.md`, `docker/README.md` | Current Markdown/MDX documentation. |

---

## Task 1: Tighten The Namespace Audit Gate

**Files:**
- Modify: `scripts/gwd-namespace-audit.mjs`
- Modify: `package.json`
- Test: `src/tests/gwd-namespace.test.ts`

- [ ] **Step 1: Update the audit patterns and allowlist**

Replace the active pattern and allowlist section in `scripts/gwd-namespace-audit.mjs` with this content:

```js
const lowerOld = "g" + "sd";
const upperOld = "G" + "SD";
const pascalOld = "G" + "sd";
const phraseOld = ["Get", "Shit", "Done"].join(" ");

const activeOldNamespacePatterns = [
  new RegExp(`(^|[^A-Za-z0-9])${lowerOld}($|[^A-Za-z0-9])`),
  new RegExp(`${upperOld}_`),
  new RegExp(`\\.${lowerOld}`),
  new RegExp(`\\/${lowerOld}`),
  new RegExp(`${lowerOld}_`),
  new RegExp(`@${lowerOld}`),
  new RegExp(`${lowerOld}-pi`),
  new RegExp(`${lowerOld}-build`),
  new RegExp(`${lowerOld}-2`),
  new RegExp(`\\b${lowerOld}[A-Z]`),
  new RegExp(`${pascalOld}[A-Z]`),
  new RegExp(`\\b${upperOld}\\b`),
  new RegExp(phraseOld),
  /gwd-build\/gwd-2/,
  /github\.com\/gwd-build\/gwd-2/,
];

const historicalAllowlist = [
  /^CHANGELOG\.md$/,
  /^docs\/dev\/superpowers\/specs\/2026-05-10-gwd-namespace-hard-cutover-design\.md$/,
  /^docs\/dev\/superpowers\/plans\/2026-05-10-gwd-namespace-hard-cutover\.md$/,
  /^docs\/dev\/superpowers\/specs\/2026-05-12-gwd-independent-initial-release-cutover-design\.md$/,
  /^docs\/dev\/superpowers\/plans\/2026-05-12-gwd-independent-initial-release-cutover\.md$/,
  /^docs\/dev\/superpowers\/specs\/2026-03-17-cicd-pipeline-design\.md$/,
  /^docs\/dev\/superpowers\/plans\/2026-03-17-cicd-pipeline\.md$/,
];
```

- [ ] **Step 2: Confirm the root script exists**

Verify `package.json` contains this script entry:

```json
"audit:gwd-namespace": "node scripts/gwd-namespace-audit.mjs"
```

If it is missing, add it under `scripts`.

- [ ] **Step 3: Run the audit and capture the baseline failure**

Run:

```bash
npm run audit:gwd-namespace
```

Expected: FAIL with active old namespace references. The count does not need to match a specific number because later tasks reduce it.

- [ ] **Step 4: Run the existing namespace unit test**

Run:

```bash
node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/tests/gwd-namespace.test.ts
```

Expected: PASS before path renames. This locks in the existing central constants before the wider cutover.

- [ ] **Step 5: Commit the audit update**

Run:

```bash
git add package.json scripts/gwd-namespace-audit.mjs
git commit -m "test: tighten gwd namespace audit"
```

---

## Task 2: Reset Release And Repository Metadata To GWD `0.0.1`

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `packages/*/package.json`
- Modify: `native/npm/*/package.json`
- Modify: `pkg/package.json`
- Modify: `web/package.json`
- Modify: `web/package-lock.json`
- Modify: `studio/package.json`
- Modify: `vscode-extension/package.json`
- Modify: `vscode-extension/package-lock.json`

- [ ] **Step 1: Run the package metadata rewrite script**

Run this from the repo root:

```bash
node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const packagePaths = [
  "package.json",
  "extensions/google-search/package.json",
  "native/npm/darwin-arm64/package.json",
  "native/npm/darwin-x64/package.json",
  "native/npm/linux-arm64-gnu/package.json",
  "native/npm/linux-x64-gnu/package.json",
  "native/npm/win32-x64-msvc/package.json",
  "packages/contracts/package.json",
  "packages/daemon/package.json",
  "packages/mcp-server/package.json",
  "packages/native/package.json",
  "packages/pi-agent-core/package.json",
  "packages/pi-ai/package.json",
  "packages/pi-coding-agent/package.json",
  "packages/pi-tui/package.json",
  "packages/rpc-client/package.json",
  "pkg/package.json",
  "src/resources/extensions/claude-code-cli/package.json",
  "src/resources/extensions/cmux/package.json",
  "src/resources/extensions/gsd/package.json",
  "studio/package.json",
  "vscode-extension/package.json",
  "web/package.json",
];

for (const rel of packagePaths) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (pkg.version) pkg.version = "0.0.1";
  if (pkg.repository && typeof pkg.repository === "object") {
    pkg.repository.url = "https://github.com/rayliu-factory/gwd.git";
  }
  if (pkg.homepage) pkg.homepage = "https://github.com/rayliu-factory/gwd#readme";
  if (pkg.bugs && typeof pkg.bugs === "object") {
    pkg.bugs.url = "https://github.com/rayliu-factory/gwd/issues";
  }
  if (pkg.description) {
    pkg.description = pkg.description
      .replaceAll("GSD-2", "GWD")
      .replaceAll("GSD", "GWD")
      .replaceAll("Get Shit Done", "Get Work Done");
  }
  if (rel === "src/resources/extensions/gsd/package.json") {
    pkg.name = "pi-extension-gwd";
  }
  if (rel === "vscode-extension/package.json") {
    pkg.name = "gwd";
    pkg.displayName = "GWD";
    pkg.description = "VS Code integration for the GWD coding agent";
  }
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
}
NODE
```

- [ ] **Step 2: Update root package version through npm**

Run:

```bash
npm version 0.0.1 --no-git-tag-version --allow-same-version
```

Expected: `package.json` and `package-lock.json` both show root version `0.0.1`.

- [ ] **Step 3: Regenerate npm lockfiles without installing packages**

Run:

```bash
npm install --package-lock-only --ignore-scripts
npm --prefix vscode-extension install --package-lock-only --ignore-scripts
npm --prefix web install --package-lock-only --ignore-scripts
```

Expected: lockfiles update package versions and repository metadata without running postinstall.

- [ ] **Step 4: Verify package versions**

Run:

```bash
node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", "dist-test", ".next", "coverage"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    if (entry.isFile() && entry.name === "package.json") {
      const pkg = JSON.parse(fs.readFileSync(full, "utf8"));
      if (pkg.version && pkg.version !== "0.0.1") {
        console.error(`${full}: ${pkg.name} has version ${pkg.version}`);
        process.exitCode = 1;
      }
    }
  }
}
walk(process.cwd());
NODE
```

Expected: no output.

- [ ] **Step 5: Commit package metadata**

Run:

```bash
git add package.json package-lock.json packages native/npm pkg web studio vscode-extension extensions src/resources/extensions
git commit -m "chore: reset gwd release metadata to 0.0.1"
```

---

## Task 3: Rename Core Extension, Workflow Resources, And Imports

**Files:**
- Rename: `src/resources/extensions/gsd/` -> `src/resources/extensions/gwd/`
- Rename: `src/resources/GSD-WORKFLOW.md` -> `src/resources/GWD-WORKFLOW.md`
- Rename: `gsd-orchestrator/` -> `gwd-orchestrator/`
- Rename: `src/resources/extensions/gwd/gsd-db.ts` -> `src/resources/extensions/gwd/gwd-db.ts`
- Rename: `src/resources/extensions/gwd/gsd-home.ts` -> `src/resources/extensions/gwd/gwd-home.ts`
- Modify: `package.json`
- Modify: `.github/workflows/*.yml`
- Modify: `src/**/*.ts`
- Modify: `scripts/**/*`

- [ ] **Step 1: Rename tracked paths with git**

Run:

```bash
git mv src/resources/extensions/gsd src/resources/extensions/gwd
git mv src/resources/GSD-WORKFLOW.md src/resources/GWD-WORKFLOW.md
git mv gsd-orchestrator gwd-orchestrator
git mv src/resources/extensions/gwd/gsd-db.ts src/resources/extensions/gwd/gwd-db.ts
git mv src/resources/extensions/gwd/gsd-home.ts src/resources/extensions/gwd/gwd-home.ts
```

Expected: `git status --short` shows renames, not delete/add pairs for these paths.

- [ ] **Step 2: Rewrite path references**

Run:

```bash
node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const ignored = new Set([".git", "node_modules", "dist", "dist-test", ".next", "coverage"]);
const textExt = new Set([".cjs", ".css", ".html", ".js", ".json", ".jsx", ".md", ".mdx", ".mjs", ".ps1", ".rs", ".sh", ".ts", ".tsx", ".txt", ".yml", ".yaml"]);
const replacements = [
  ["src/resources/extensions/gsd", "src/resources/extensions/gwd"],
  ["dist-test/src/resources/extensions/gsd", "dist-test/src/resources/extensions/gwd"],
  ["src/resources/GSD-WORKFLOW.md", "src/resources/GWD-WORKFLOW.md"],
  ["GSD-WORKFLOW.md", "GWD-WORKFLOW.md"],
  ["gsd-orchestrator", "gwd-orchestrator"],
  ["./gsd-db.js", "./gwd-db.js"],
  ["../gsd-db.ts", "../gwd-db.ts"],
  ["../gsd-db.js", "../gwd-db.js"],
  ["./gsd-db.ts", "./gwd-db.ts"],
  ["./gsd-home.js", "./gwd-home.js"],
  ["../gsd-home.js", "../gwd-home.js"],
  ["gsd-db.ts", "gwd-db.ts"],
  ["gsd-home.ts", "gwd-home.ts"],
  ["pi-extension-gsd", "pi-extension-gwd"],
];

function isText(file) {
  const ext = path.extname(file);
  return textExt.has(ext) || file.endsWith("Dockerfile") || path.basename(file).startsWith(".");
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    if (entry.isFile() && isText(full)) {
      let content = fs.readFileSync(full, "utf8");
      let next = content;
      for (const [from, to] of replacements) next = next.split(from).join(to);
      if (next !== content) fs.writeFileSync(full, next);
    }
  }
}
walk(root);
NODE
```

- [ ] **Step 3: Run a compile check for import breakage**

Run:

```bash
npm run typecheck:extensions
```

Expected: FAIL only on unresolved paths and old symbol names introduced by the rename. Fix direct import path errors before continuing to Task 4.

- [ ] **Step 4: Run targeted extension tests**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/paths-cache.test.ts src/resources/extensions/gwd/tests/gsd-root-canonical.test.ts
```

Expected: FAIL before runtime path and symbol renames. The command itself should resolve through the renamed `gwd/tests/resolve-ts.mjs` loader.

- [ ] **Step 5: Commit path renames**

Run:

```bash
git add -A src/resources/extensions src/resources/GWD-WORKFLOW.md gwd-orchestrator package.json .github scripts
git commit -m "refactor: rename core workflow extension to gwd"
```

---

## Task 4: Cut Runtime State From `.gsd` To `.gwd`

**Files:**
- Modify: `src/namespace.ts`
- Modify: `src/app-paths.ts`
- Modify: `src/headless.ts`
- Modify: `src/headless-context.ts`
- Modify: `src/resources/extensions/gwd/paths.ts`
- Modify: `src/resources/extensions/gwd/gwd-home.ts`
- Modify: `src/resources/extensions/gwd/init-wizard.ts`
- Modify: `src/resources/extensions/gwd/detection.ts`
- Modify: `src/resources/extensions/gwd/doctor*.ts`
- Modify: `src/resources/extensions/gwd/tests/**/*.ts`
- Modify: `src/tests/gwd-namespace.test.ts`

- [ ] **Step 1: Pin namespace constants**

Verify `src/namespace.ts` exactly reflects the active constants:

```ts
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

- [ ] **Step 2: Rewrite runtime state literals in active source and tests**

Run:

```bash
node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const roots = ["src", "scripts", "tests", "web", "vscode-extension", "docker", ".github"];
const exts = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".mdx", ".yml", ".yaml", ".sh", ".ps1"]);
const replacements = [
  ["~/.gsd", "~/.gwd"],
  [".gsd/", ".gwd/"],
  [".gsd", ".gwd"],
  ["GSD_HOME", "GWD_HOME"],
  ["GSD_BIN_PATH", "GWD_BIN_PATH"],
  ["GSD_VERSION", "GWD_VERSION"],
  ["GSD_HEADLESS", "GWD_HEADLESS"],
  ["GSD_RTK_DISABLED", "GWD_RTK_DISABLED"],
  ["GSD_RTK_PATH", "GWD_RTK_PATH"],
  ["GSD_SKIP_RTK_INSTALL", "GWD_SKIP_RTK_INSTALL"],
  ["gsd.db", "gwd.db"],
];
function visit(file) {
  const stat = fs.statSync(file);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(file)) visit(path.join(file, entry));
    return;
  }
  if (!stat.isFile() || !exts.has(path.extname(file))) return;
  let content = fs.readFileSync(file, "utf8");
  let next = content;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  if (next !== content) fs.writeFileSync(file, next);
}
for (const root of roots) if (fs.existsSync(root)) visit(root);
NODE
```

- [ ] **Step 3: Rename path-contract identifiers**

In `src/resources/extensions/gwd/paths.ts`, rename exported `Gsd` identifiers to `Gwd` identifiers. Use this mapping consistently across imports:

```text
GsdPathContract -> GwdPathContract
resolveGsdPathContract -> resolveGwdPathContract
clearGsdPathContractCache -> clearGwdPathContractCache
```

Run this check after edits:

```bash
rg -n "resolveGsdPathContract|GsdPathContract|clearGsdPathContractCache" src scripts tests web vscode-extension --glob '!node_modules/**'
```

Expected: no output.

- [ ] **Step 4: Update namespace tests for hard cutover**

In `src/tests/gwd-namespace.test.ts`, keep the existing constant assertions and ensure the legacy env test still proves `GSD_HOME` is ignored:

```ts
const LEGACY_HOME_ENV = "G" + "SD_HOME";
```

Expected behavior: `GWD_HOME` wins when set; `GSD_HOME` alone does not change the default `~/.gwd` path.

- [ ] **Step 5: Run targeted runtime path tests**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/tests/gwd-namespace.test.ts src/resources/extensions/gwd/tests/paths-cache.test.ts src/resources/extensions/gwd/tests/db-path-worktree-symlink.test.ts src/resources/extensions/gwd/tests/doctor-scope-db-unavailable.test.ts
```

Expected: PASS after all `.gwd/gwd.db` path expectations are updated.

- [ ] **Step 6: Commit runtime state cutover**

Run:

```bash
git add -A src scripts tests web vscode-extension docker .github
git commit -m "refactor: move runtime state to gwd paths"
```

---

## Task 5: Rename Tool, Slash Command, And Code Namespace Surfaces

**Files:**
- Modify: `src/resources/extensions/gwd/**/*.ts`
- Modify: `src/resources/extensions/gwd/prompts/**/*.md`
- Modify: `src/resources/extensions/gwd/templates/**/*`
- Modify: `src/resources/extensions/gwd/package.json`
- Modify: `src/headless*.ts`
- Modify: `src/help-text.ts`
- Modify: `src/cli.ts`
- Modify: `src/tests/**/*.ts`

- [ ] **Step 1: Run the controlled namespace replacement**

Run:

```bash
node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const roots = ["src", "scripts", "tests", "web", ".github"];
const exts = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".mdx", ".yml", ".yaml", ".sh", ".ps1"]);
const replacements = [
  ["/gsd", "/gwd"],
  ["gsd_", "gwd_"],
  ["GSD_", "GWD_"],
  ["GSD-2", "GWD"],
  ["GSD 2", "GWD"],
  ["GSD", "GWD"],
  ["Get Shit Done", "Get Work Done"],
  ["Gsd", "Gwd"],
  ["gsd-pi", "gwd-pi"],
  ["@gsd-build", "@gwd-build"],
  ["@gsd-extensions", "@gwd-extensions"],
  ["@gsd/", "@gwd/"],
  ["gsd-build/GSD-2", "rayliu-factory/gwd"],
  ["gwd-build/gwd-2", "rayliu-factory/gwd"],
  ["github.com/gwd-build/gwd-2", "github.com/rayliu-factory/gwd"],
];
function visit(file) {
  const stat = fs.statSync(file);
  if (stat.isDirectory()) {
    if (["node_modules", ".git", "dist", "dist-test", ".next", "coverage"].includes(path.basename(file))) return;
    for (const entry of fs.readdirSync(file)) visit(path.join(file, entry));
    return;
  }
  if (!stat.isFile() || !exts.has(path.extname(file))) return;
  let content = fs.readFileSync(file, "utf8");
  let next = content;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  next = next.replace(/\bgsd\b/g, "gwd");
  if (next !== content) fs.writeFileSync(file, next);
}
for (const root of roots) if (fs.existsSync(root)) visit(root);
NODE
```

- [ ] **Step 2: Fix intentionally named tests after broad replacements**

Open `src/resources/extensions/gwd/tests/init-wizard.test.ts` and update state labels so they describe GWD, not GSD. The expected labels should be:

```ts
"v2-gwd"
"v2-gwd-empty"
```

If production detection code still returns `v2-gsd`, update the production enum/string literals in `src/resources/extensions/gwd/detection.ts` and `src/resources/extensions/gwd/init-wizard.ts` to `v2-gwd` and `v2-gwd-empty`.

- [ ] **Step 3: Verify no active tool/slash names remain**

Run:

```bash
rg -n "gsd_|/gsd|GSD_|Gsd[A-Z]|\\bGSD\\b|Get Shit Done|gsd-pi|@gsd|gsd-build|gwd-build/gwd-2" src scripts tests web .github --glob '!node_modules/**' --glob '!dist/**' --glob '!dist-test/**'
```

Expected: no output outside allowlisted spec/plan files.

- [ ] **Step 4: Run command and tool tests**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/tests/parse-cli-args.test.ts src/tests/headless-cli-surface.test.ts src/resources/extensions/gwd/tests/commands-do.test.ts src/resources/extensions/gwd/tests/tool-compatibility.test.ts src/resources/extensions/gwd/tests/mcp-status.test.ts
```

Expected: PASS with `/gwd` and `gwd_*` expectations.

- [ ] **Step 5: Commit command and tool namespace changes**

Run:

```bash
git add -A src scripts tests web .github
git commit -m "refactor: rename workflow commands and tools to gwd"
```

---

## Task 6: Cut Over VS Code Extension Identity

**Files:**
- Rename: `vscode-extension/src/gsd-client.ts` -> `vscode-extension/src/gwd-client.ts`
- Rename: `vscode-extension/src/gsd-client-spawn.ts` -> `vscode-extension/src/gwd-client-spawn.ts`
- Modify: `vscode-extension/package.json`
- Modify: `vscode-extension/package-lock.json`
- Modify: `vscode-extension/src/**/*.ts`
- Modify: `vscode-extension/test/**/*.ts`
- Modify: `vscode-extension/README.md`
- Modify: `vscode-extension/CHANGELOG.md`

- [ ] **Step 1: Rename VS Code client source files**

Run:

```bash
git mv vscode-extension/src/gsd-client.ts vscode-extension/src/gwd-client.ts
git mv vscode-extension/src/gsd-client-spawn.ts vscode-extension/src/gwd-client-spawn.ts
```

- [ ] **Step 2: Rewrite VS Code source and manifest names**

Run:

```bash
node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const root = "vscode-extension";
const exts = new Set([".ts", ".json", ".md"]);
const replacements = [
  ["./gsd-client.js", "./gwd-client.js"],
  ["./gsd-client-spawn.js", "./gwd-client-spawn.js"],
  ["Gsd", "Gwd"],
  ["gsd.", "gwd."],
  ["gsd-", "gwd-"],
  ["@gsd", "@gwd"],
  ["/gsd", "/gwd"],
  ["GSD-2", "GWD"],
  ["GSD", "GWD"],
  ["gsd", "gwd"],
];
function visit(file) {
  const stat = fs.statSync(file);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(file)) visit(path.join(file, entry));
    return;
  }
  if (!stat.isFile() || !exts.has(path.extname(file))) return;
  let content = fs.readFileSync(file, "utf8");
  let next = content;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  if (next !== content) fs.writeFileSync(file, next);
}
visit(root);
NODE
```

- [ ] **Step 3: Ensure key manifest values are GWD**

In `vscode-extension/package.json`, verify these values:

```json
{
  "name": "gwd",
  "displayName": "GWD",
  "contributes": {
    "chatParticipants": [
      {
        "id": "gwd.agent",
        "name": "gwd",
        "fullName": "GWD Agent"
      }
    ],
    "configuration": {
      "title": "GWD",
      "properties": {
        "gwd.binaryPath": {
          "default": "gwd"
        }
      }
    }
  }
}
```

Do not paste this object over the whole file; verify and adjust these nested values in place so existing commands, menus, and configuration schema are preserved under `gwd`.

- [ ] **Step 4: Run VS Code tests**

Run:

```bash
npm --prefix vscode-extension test
```

Expected: PASS. If `test` is not defined in `vscode-extension/package.json`, run:

```bash
node --test vscode-extension/test/*.test.ts
```

Expected: PASS or a TypeScript loader error that is fixed by using the repo's existing VS Code test command from `vscode-extension/package.json`.

- [ ] **Step 5: Commit VS Code cutover**

Run:

```bash
git add -A vscode-extension
git commit -m "refactor: rename vscode extension to gwd"
```

---

## Task 7: Update Docker, CI, Native Artifact, And Repository Metadata

**Files:**
- Modify: `.github/workflows/*.yml`
- Modify: `.github/ISSUE_TEMPLATE/*.yml`
- Modify: `.github/PULL_REQUEST_TEMPLATE.md`
- Modify: `docker/Dockerfile*`
- Modify: `docker/docker-compose*.yaml`
- Modify: `docker/entrypoint.sh`
- Modify: `docker/bootstrap.sh`
- Modify: `docker/.env.example`
- Modify: `docker/README.md`
- Modify: `native/**/*`
- Modify: `packages/native/package.json`

- [ ] **Step 1: Rewrite CI, Docker, and native metadata**

Run:

```bash
node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const roots = [".github", "docker", "native", "packages/native"];
const exts = new Set([".ts", ".rs", ".json", ".md", ".yml", ".yaml", ".sh", ".env", ""]);
const replacements = [
  ["gsd_engine", "gwd_engine"],
  ["gsd-sandbox", "gwd-sandbox"],
  ["gsd-state", "gwd-state"],
  ["/home/gsd", "/home/gwd"],
  ["GSD_USER", "GWD_USER"],
  ["GSD_HOME", "GWD_HOME"],
  ["GSD_DIR", "GWD_DIR"],
  ["GSD_VERSION", "GWD_VERSION"],
  ["GSD web UI", "GWD web UI"],
  ["GSD Container Entrypoint", "GWD Container Entrypoint"],
  ["GSD is installed", "GWD is installed"],
  ["rayliu-factory/gwd-pi", "rayliu-factory/gwd-pi"],
  ["gwd-build/gwd-2", "rayliu-factory/gwd"],
  ["github.com/gwd-build/gwd-2", "github.com/rayliu-factory/gwd"],
  ["gsd", "gwd"],
  ["GSD", "GWD"],
];
function visit(file) {
  const stat = fs.statSync(file);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(file)) visit(path.join(file, entry));
    return;
  }
  const ext = path.extname(file);
  if (!stat.isFile() || (!exts.has(ext) && !path.basename(file).startsWith("Dockerfile"))) return;
  let content = fs.readFileSync(file, "utf8");
  let next = content;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  if (next !== content) fs.writeFileSync(file, next);
}
for (const root of roots) if (fs.existsSync(root)) visit(root);
NODE
```

- [ ] **Step 2: Check native binary references**

Run:

```bash
rg -n "gsd_engine|gwd-build/gwd-2|github.com/gwd-build/gwd-2|\\bGSD\\b|\\bgsd\\b|\\.gsd" .github docker native packages/native --glob '!node_modules/**'
```

Expected: no output unless the hit is in an explicitly historical comment that should be rewritten to GWD.

- [ ] **Step 3: Run native package metadata checks**

Run:

```bash
npm run sync-platform-versions
npm run test:native
```

Expected: PASS. If native build dependencies are unavailable, record the exact missing tool or compiler error and continue only after confirming package metadata files are updated.

- [ ] **Step 4: Commit infrastructure metadata**

Run:

```bash
git add -A .github docker native packages/native package.json package-lock.json
git commit -m "chore: update gwd infrastructure metadata"
```

---

## Task 8: Update Current README, Markdown, And MDX Docs

**Files:**
- Modify: `README.md`
- Modify: `VISION.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/**/*.md`
- Modify: `gitbook/**/*.md`
- Modify: `mintlify-docs/**/*.mdx`
- Modify: `tests/e2e/README.md`
- Modify: `packages/**/README.md`
- Modify: `docker/README.md`
- Modify: `gwd-orchestrator/**/*.md`

- [ ] **Step 1: Apply the safe docs replacement pass**

Run:

```bash
node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const roots = ["README.md", "VISION.md", "CONTRIBUTING.md", "docs", "gitbook", "mintlify-docs", "tests/e2e/README.md", "packages", "docker/README.md", "gwd-orchestrator"];
const replacements = [
  ["GSD-2", "GWD"],
  ["GSD 2", "GWD"],
  ["Get Shit Done", "Get Work Done"],
  ["gsd-pi", "gwd-pi"],
  ["npm install -g gsd", "npm install -g gwd"],
  ["npm install -g gwd-pi", "npm install -g gwd-pi"],
  ["`gsd`", "`gwd`"],
  ["`/gsd", "`/gwd"],
  [" /gsd", " /gwd"],
  ["@gsd", "@gwd"],
  ["@gsd-build", "@gwd-build"],
  ["@gsd-extensions", "@gwd-extensions"],
  [".gsd/", ".gwd/"],
  [".gsd", ".gwd"],
  ["GSD_", "GWD_"],
  ["gsd_", "gwd_"],
  ["gsd.db", "gwd.db"],
  ["gsd-build/GSD-2", "rayliu-factory/gwd"],
  ["gwd-build/gwd-2", "rayliu-factory/gwd"],
  ["github.com/gwd-build/gwd-2", "github.com/rayliu-factory/gwd"],
  ["github.com/gsd-build/GSD-2", "github.com/rayliu-factory/gwd"],
  ["GSD", "GWD"],
];
function rewriteFile(file) {
  if (!/\.(md|mdx)$/.test(file)) return;
  let content = fs.readFileSync(file, "utf8");
  let next = content;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  next = next.replace(/\bgsd\b/g, "gwd");
  if (next !== content) fs.writeFileSync(file, next);
}
function visit(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    if (["node_modules", "dist", "dist-test", ".next", "coverage"].includes(path.basename(target))) return;
    for (const entry of fs.readdirSync(target)) visit(path.join(target, entry));
    return;
  }
  if (stat.isFile()) rewriteFile(target);
}
for (const root of roots) visit(root);
NODE
```

- [ ] **Step 2: Rewrite the root README opening**

Open `README.md` and replace the old product opening with GWD initial-release positioning:

```md
# GWD

**Get Work Done: an agentic coding CLI for planning, execution, verification, and shipping.**

GWD is a standalone CLI built on the Pi SDK. It manages project state, agent sessions, workflow tools, model routing, git isolation, recovery, and verification from one command-line entry point.

```bash
npm install -g gwd-pi@latest
gwd
```
```

Remove any current-release paragraph that describes the product as "GSD 2" or as an evolution of Get Shit Done.

- [ ] **Step 3: Remove active migration-from-GSD guidance**

In current user docs, remove pages or sections that tell users to migrate from `.gsd` to `.gwd` or from GSD to GWD. Keep migration guidance only for `.planning` if it remains a current feature. If a page is only about GSD history, either move it into a historical allowlisted doc or rewrite it as GWD initial-release guidance.

- [ ] **Step 4: Check Markdown for old active namespace hits**

Run:

```bash
rg -n --glob '*.md' --glob '*.mdx' "Get Shit Done|\\bGSD\\b|\\bgsd\\b|/gsd|\\.gsd|gsd_|GSD_|gsd-pi|@gsd|gsd-build|gwd-build/gwd-2" README.md VISION.md CONTRIBUTING.md docs gitbook mintlify-docs tests/e2e packages docker gwd-orchestrator
```

Expected: hits only in explicitly historical allowlisted docs. Rewrite all current docs until this command is clean for active docs.

- [ ] **Step 5: Run Markdown whitespace check**

Run:

```bash
git diff --check -- README.md VISION.md CONTRIBUTING.md docs gitbook mintlify-docs tests/e2e packages docker gwd-orchestrator
```

Expected: no output.

- [ ] **Step 6: Commit docs cutover**

Run:

```bash
git add -A README.md VISION.md CONTRIBUTING.md docs gitbook mintlify-docs tests/e2e packages docker gwd-orchestrator
git commit -m "docs: rewrite current docs for gwd initial release"
```

---

## Task 9: Update Web Surfaces And API Root Names

**Files:**
- Rename: `web/components/gsd/` -> `web/components/gwd/`
- Rename: `web/lib/gsd-workspace-store.tsx` -> `web/lib/gwd-workspace-store.tsx`
- Rename: `web/lib/initial-gsd-header-filter.ts` -> `web/lib/initial-gwd-header-filter.ts`
- Modify: `web/app/**/*.ts`
- Modify: `web/app/**/*.tsx`
- Modify: `web/components/**/*.ts`
- Modify: `web/components/**/*.tsx`
- Modify: `web/lib/**/*.ts`
- Modify: `web/lib/**/*.tsx`
- Modify: `src/web/**/*.ts`
- Modify: `src/tests/integration/web-*.test.ts`

- [ ] **Step 1: Rename web directories and files**

Run:

```bash
git mv web/components/gsd web/components/gwd
git mv web/lib/gsd-workspace-store.tsx web/lib/gwd-workspace-store.tsx
git mv web/lib/initial-gsd-header-filter.ts web/lib/initial-gwd-header-filter.ts
```

- [ ] **Step 2: Rewrite web imports and private root enum values**

Run:

```bash
node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const roots = ["web", "src/web", "src/tests/integration"];
const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md"]);
const replacements = [
  ["components/gsd", "components/gwd"],
  ["gsd-workspace-store", "gwd-workspace-store"],
  ["initial-gsd-header-filter", "initial-gwd-header-filter"],
  ['"gsd"', '"gwd"'],
  ["'gsd'", "'gwd'"],
  ["root=gsd", "root=gwd"],
  ["GSD", "GWD"],
  ["gsd", "gwd"],
  ["/gsd", "/gwd"],
  [".gsd", ".gwd"],
];
function visit(file) {
  const stat = fs.statSync(file);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(file)) visit(path.join(file, entry));
    return;
  }
  if (!stat.isFile() || !exts.has(path.extname(file))) return;
  let content = fs.readFileSync(file, "utf8");
  let next = content;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  if (next !== content) fs.writeFileSync(file, next);
}
for (const root of roots) if (fs.existsSync(root)) visit(root);
NODE
```

- [ ] **Step 3: Verify web file-root behavior**

In `web/app/api/files/route.ts`, verify the root mode is:

```ts
type RootMode = "gwd" | "project";
```

Verify the default root is `gwd` and error messages say:

```ts
`Invalid root: must be "gwd" or "project"`
```

- [ ] **Step 4: Run web integration tests**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/tests/integration/web-state-surfaces-contract.test.ts src/tests/integration/web-command-parity-contract.test.ts src/tests/integration/web-project-url.test.ts
```

Expected: PASS after expectations use GWD.

- [ ] **Step 5: Commit web cutover**

Run:

```bash
git add -A web src/web src/tests/integration
git commit -m "refactor: rename web surfaces to gwd"
```

---

## Task 10: Update Test Fixtures And Compile Globs

**Files:**
- Modify: `package.json`
- Modify: `scripts/compile-tests.mjs`
- Modify: `scripts/dist-test-resolve.mjs`
- Modify: `src/tests/**/*.ts`
- Modify: `src/resources/extensions/gwd/tests/**/*.ts`
- Modify: `tests/**/*.ts`
- Modify: `tests/**/*.md`

- [ ] **Step 1: Update package test globs**

In `package.json`, replace every test glob containing `extensions/gsd` with `extensions/gwd`. Examples:

```json
"node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test"
```

and:

```json
"dist-test/src/resources/extensions/gwd/tests/*.test.js"
```

- [ ] **Step 2: Rewrite test fixture names and temp prefixes**

Run:

```bash
node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const roots = ["src/tests", "src/resources/extensions/gwd/tests", "tests", "scripts"];
const exts = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md"]);
const replacements = [
  ["src/resources/extensions/gsd", "src/resources/extensions/gwd"],
  ["dist-test/src/resources/extensions/gsd", "dist-test/src/resources/extensions/gwd"],
  ["gsd-", "gwd-"],
  ["gsd_", "gwd_"],
  ["GSD_", "GWD_"],
  ["GSD", "GWD"],
  ["Gsd", "Gwd"],
  ["/gsd", "/gwd"],
  [".gsd", ".gwd"],
  ["gsd.db", "gwd.db"],
  ["../gsd-db.ts", "../gwd-db.ts"],
  ["../gsd-db.js", "../gwd-db.js"],
];
function visit(file) {
  const stat = fs.statSync(file);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(file)) visit(path.join(file, entry));
    return;
  }
  if (!stat.isFile() || !exts.has(path.extname(file))) return;
  let content = fs.readFileSync(file, "utf8");
  let next = content;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  next = next.replace(/\bgsd\b/g, "gwd");
  if (next !== content) fs.writeFileSync(file, next);
}
for (const root of roots) if (fs.existsSync(root)) visit(root);
NODE
```

- [ ] **Step 3: Compile tests**

Run:

```bash
npm run test:compile
```

Expected: PASS. Fix any unresolved `gsd` import paths or renamed file references.

- [ ] **Step 4: Run focused namespace and runtime tests**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/tests/gwd-namespace.test.ts src/tests/parse-cli-args.test.ts src/tests/headless-cli-surface.test.ts src/resources/extensions/gwd/tests/init-wizard.test.ts src/resources/extensions/gwd/tests/headless-query.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit test cutover**

Run:

```bash
git add -A package.json scripts src/tests src/resources/extensions/gwd/tests tests
git commit -m "test: update fixtures for gwd namespace"
```

---

## Task 11: Make The Namespace Audit Pass

**Files:**
- Modify: all remaining active files reported by `npm run audit:gwd-namespace`
- Modify: `scripts/gwd-namespace-audit.mjs`

- [ ] **Step 1: Run the audit**

Run:

```bash
npm run audit:gwd-namespace
```

Expected: FAIL if any active old namespace references remain.

- [ ] **Step 2: Fix each active audit hit**

For each reported line, apply one of these exact actions:

```text
Current runtime/docs/test/package reference -> rename to GWD/GWD_*//gwd/.gwd/gwd_.
Old implementation-plan or old design-doc reference -> add the file to historicalAllowlist only if the entire file is historical.
Generated output or dependency file -> add the parent directory to ignoredDirs only if the directory is generated and should never be committed as source.
```

Do not add current docs, runtime code, tests, package metadata, CI, Docker, VS Code, or web source to the historical allowlist.

- [ ] **Step 3: Verify the audit passes**

Run:

```bash
npm run audit:gwd-namespace
```

Expected:

```text
GWD namespace audit passed
```

- [ ] **Step 4: Commit audit cleanup**

Run:

```bash
git status --short
git add scripts/gwd-namespace-audit.mjs
git add README.md VISION.md CONTRIBUTING.md docs gitbook mintlify-docs src scripts tests web vscode-extension docker .github package.json package-lock.json packages native/npm pkg gwd-orchestrator
git commit -m "chore: clear active gsd namespace drift"
```

Stage only files changed to clear audit output. Do not stage unrelated local edits.

---

## Task 12: Final Verification And Release Contract

**Files:**
- Read: `package.json`
- Read: `package-lock.json`
- Read: `src/namespace.ts`
- Read: `scripts/gwd-namespace-audit.mjs`

- [ ] **Step 1: Run fast verification**

Run:

```bash
npm run audit:gwd-namespace
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/tests/gwd-namespace.test.ts
git diff --check
```

Expected: all commands pass.

- [ ] **Step 2: Run compile and typecheck**

Run:

```bash
npm run test:compile
npm run typecheck:extensions
```

Expected: both commands pass.

- [ ] **Step 3: Run package validation**

Run:

```bash
npm run validate-pack
```

Expected: PASS and package metadata references GWD.

- [ ] **Step 4: Run unit tests**

Run:

```bash
npm run test:unit
```

Expected: PASS.

- [ ] **Step 5: Run integration tests**

Run:

```bash
npm run test:integration
```

Expected: PASS.

- [ ] **Step 6: Run PR verification if runtime is stable**

Run:

```bash
npm run verify:pr
```

Expected: PASS. If this fails after the prior targeted gates passed, inspect the failing command output and fix only regressions caused by the namespace cutover.

- [ ] **Step 7: Confirm release identity manually**

Run:

```bash
node <<'NODE'
const pkg = require("./package.json");
if (pkg.name !== "gwd-pi") throw new Error(`root package name is ${pkg.name}`);
if (pkg.version !== "0.0.1") throw new Error(`root version is ${pkg.version}`);
if (pkg.repository.url !== "https://github.com/rayliu-factory/gwd.git") throw new Error(`repo is ${pkg.repository.url}`);
console.log(`${pkg.name}@${pkg.version} -> ${pkg.repository.url}`);
NODE
```

Expected:

```text
gwd-pi@0.0.1 -> https://github.com/rayliu-factory/gwd.git
```

- [ ] **Step 8: Commit final verification fixes**

Run:

```bash
git status --short
git add package.json package-lock.json scripts src tests web vscode-extension docs gitbook mintlify-docs docker .github packages native/npm pkg gwd-orchestrator
git commit -m "chore: verify gwd initial release cutover"
```

Expected: create a commit only if verification required additional fixes. If `git status --short` is empty, skip the commit. Stage only verification fixes, not unrelated local edits.
