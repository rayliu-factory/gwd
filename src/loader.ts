#!/usr/bin/env node
// GWD Startup Loader
import { fileURLToPath } from 'url'
import { dirname, resolve, join, relative, delimiter } from 'path'
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, symlinkSync, cpSync } from 'fs'
import {
  CLI_COMMAND,
  GWD_VERSION_ENV,
  PRODUCT_DISPLAY_NAME,
  PRODUCT_FULL_NAME,
  PRODUCT_PACKAGE_NAME,
} from './namespace.js'

// Fast-path: handle --version/-v and --help/-h before importing any heavy
// dependencies. This avoids loading the entire pi-coding-agent barrel import
// (~1s) just to print a version string.
const gsdRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const firstArg = args[0]

// Read package.json once — reused for version, banner, and GWD_VERSION below
let gsdVersion = '0.0.0'
try {
  const pkg = JSON.parse(readFileSync(join(gsdRoot, 'package.json'), 'utf-8'))
  gsdVersion = pkg.version || '0.0.0'
} catch { /* ignore */ }

if (firstArg === '--version' || firstArg === '-v') {
  process.stdout.write(gsdVersion + '\n')
  process.exit(0)
}

if (firstArg === '--help' || firstArg === '-h') {
  const { printHelp } = await import('./help-text.js')
  printHelp(gsdVersion)
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Runtime dependency checks — fail fast with clear diagnostics before any
// heavy imports. Reads minimum Node version from the engines field in
// package.json (already parsed above) and verifies git is available.
// ---------------------------------------------------------------------------
{
  const { MIN_NODE_MAJOR, checkNodeVersion, requireGit } = await import('./runtime-checks.js')
  const red = '\x1b[31m'
  const bold = '\x1b[1m'
  const dim = '\x1b[2m'
  const reset = '\x1b[0m'

  // -- Node version --
  const nodeCheck = checkNodeVersion(process.versions.node, MIN_NODE_MAJOR)
  if (!nodeCheck.ok) {
    process.stderr.write(
      `\n${red}${bold}Error:${reset} ${PRODUCT_DISPLAY_NAME} requires Node.js >= ${MIN_NODE_MAJOR}.0.0\n` +
      `       You are running Node.js ${process.versions.node}\n\n` +
      `${dim}Install a supported version:${reset}\n` +
      `  nvm install ${MIN_NODE_MAJOR}   ${dim}# if using nvm${reset}\n` +
      `  fnm install ${MIN_NODE_MAJOR}   ${dim}# if using fnm${reset}\n` +
      `  brew install node@${MIN_NODE_MAJOR} ${dim}# macOS Homebrew${reset}\n\n`
    )
    process.exit(1)
  }

  // -- git --
  const { execFileSync } = await import('child_process')
  const gitOk = requireGit((cmd, args) => execFileSync(cmd, args as string[], { stdio: 'ignore' }))
  if (!gitOk) {
    process.stderr.write(
      `\n${red}${bold}Error:${reset} ${PRODUCT_DISPLAY_NAME} requires git but it was not found on PATH.\n\n` +
      `${dim}Install git:${reset}\n` +
      `  https://git-scm.com/downloads\n\n`
    )
    process.exit(1)
  }
}

import { agentDir, appRoot } from './app-paths.js'
import { applyRtkProcessEnv } from './rtk-shared.js'
import { serializeBundledExtensionPaths } from './bundled-extension-paths.js'
import { resolveBundledResourcesDirFromPackageRoot } from './bundled-resource-path.js'
import { discoverExtensionEntryPaths } from './extension-discovery.js'
import { loadRegistry, readManifestFromEntryPath, isExtensionEnabled } from './extension-registry.js'
import { applyLoaderCliEntrypointEnv } from './loader-entrypoint.js'
import { renderLogo } from './logo.js'

// pkg/ is a shim directory: contains gwd's piConfig (package.json) and pi's
// theme assets (dist/modes/interactive/theme/) without a src/ directory.
// This allows config.js to:
//   1. Read piConfig.name → "gwd" (branding)
//   2. Resolve themes via dist/ (no src/ present → uses dist path)
const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'pkg')

// MUST be set before any dynamic import of pi SDK fires — this is what config.js
// reads to determine APP_NAME and CONFIG_DIR_NAME
process.env.PI_PACKAGE_DIR = pkgDir
process.env.PI_SKIP_VERSION_CHECK = '1'  // GSD runs its own update check in cli.ts — suppress pi's
process.title = CLI_COMMAND

// Print branded banner on first launch (before ~/.gwd/ exists).
// Set GWD_FIRST_RUN_BANNER so cli.ts skips the duplicate welcome screen.
if (!existsSync(appRoot)) {
  const cyan  = '\x1b[36m'
  const green = '\x1b[32m'
  const dim   = '\x1b[2m'
  const reset = '\x1b[0m'
  const colorCyan = (s: string) => `${cyan}${s}${reset}`
  process.stderr.write(
    renderLogo(colorCyan) +
    '\n' +
    `  ${PRODUCT_FULL_NAME} ${dim}v${gsdVersion}${reset}\n` +
    `  ${green}Welcome.${reset} Setting up your environment...\n\n`
  )
  process.env.GWD_FIRST_RUN_BANNER = '1'
}

// GWD_CODING_AGENT_DIR — tells pi's getAgentDir() to return ~/.gwd/agent/
process.env.GWD_CODING_AGENT_DIR = agentDir

// GWD_PKG_ROOT — absolute path to the gwd-pi package root. Used by deployed extensions
// (e.g. auto.ts resume path) to import modules like resource-loader.js that live
// in the package tree, not in the deployed ~/.gsd/agent/ tree.
process.env.GWD_PKG_ROOT = gsdRoot

// RTK environment — make ~/.gsd/agent/bin visible to all child-process paths,
// not just the bash tool, and force-disable RTK telemetry for GSD-managed use.
applyRtkProcessEnv(process.env)

// NODE_PATH — make gsd's own node_modules available to extensions loaded via jiti.
// Without this, extensions (e.g. browser-tools) can't resolve dependencies like
// `playwright` because jiti resolves modules from pi-coding-agent's location, not gsd's.
// Prepending gsd's node_modules to NODE_PATH fixes this for all extensions.
const gsdNodeModules = join(gsdRoot, 'node_modules')
process.env.NODE_PATH = [gsdNodeModules, process.env.NODE_PATH]
  .filter(Boolean)
  .join(delimiter)
// Force Node to re-evaluate module search paths with the updated NODE_PATH.
// Must happen synchronously before cli.js imports → extension loading.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Module } = await import('module');
(Module as any)._initPaths?.()

// GWD_VERSION — expose package version so extensions can display it
process.env[GWD_VERSION_ENV] = gsdVersion

// GWD_BIN_PATH — absolute path to the CLI entrypoint, used by patched
// subagent/parallel workers to spawn gsd instead of pi when dispatching
// workflow tasks. In source-dev mode this must remain scripts/dev-cli.js, not
// src/loader.ts, because child processes need the --import resolve-ts wrapper.
applyLoaderCliEntrypointEnv(process.env, { gsdRoot, invokedBinPath: process.argv[1] })

// GWD_WORKFLOW_PATH — absolute path to bundled GSD-WORKFLOW.md, used by patched gsd extension
// when dispatching workflow prompts. Prefers dist/resources/ (stable, set at build time)
// over src/resources/ (live working tree) — see resource-loader.ts for rationale.
const resourcesDir = resolveBundledResourcesDirFromPackageRoot(gsdRoot)
process.env.GWD_WORKFLOW_PATH = join(resourcesDir, 'GSD-WORKFLOW.md')

// GWD_BUNDLED_EXTENSION_PATHS — dynamically discovered bundled extension entry points.
// Uses the shared discoverExtensionEntryPaths() to scan the bundled resources
// directory, then remaps discovered paths to agentDir (~/.gsd/agent/extensions/)
// where initResources() will sync them.
const bundledExtDir = join(resourcesDir, 'extensions')
const agentExtDir = join(agentDir, 'extensions')
const registry = loadRegistry()
const discoveredExtensionPaths = discoverExtensionEntryPaths(bundledExtDir)
  .map((entryPath) => join(agentExtDir, relative(bundledExtDir, entryPath)))
  .filter((entryPath) => {
    const manifest = readManifestFromEntryPath(entryPath)
    if (!manifest) return true  // no manifest = always load
    return isExtensionEnabled(registry, manifest.id)
  })

process.env.GWD_BUNDLED_EXTENSION_PATHS = serializeBundledExtensionPaths(discoveredExtensionPaths)

// Respect HTTP_PROXY / HTTPS_PROXY / NO_PROXY env vars for all outbound requests.
// pi-coding-agent's cli.ts sets this, but GSD bypasses that entry point — so we
// must set it here before any SDK clients are created.
// Lazy-load undici (~200ms) only when proxy env vars are actually set.
if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy) {
  const { EnvHttpProxyAgent, setGlobalDispatcher } = await import('undici')
  setGlobalDispatcher(new EnvHttpProxyAgent())
}

// Ensure workspace packages are linked (or copied on Windows) before importing
// cli.js (which imports @gwd/*).
// npm postinstall handles this normally, but npx --ignore-scripts skips postinstall.
// On Windows without Developer Mode or admin rights, symlinkSync will throw even for
// 'junction' type — so we fall back to cpSync (a full directory copy) which works
// everywhere without elevated permissions.
// Discover linkable workspace packages by scanning packages/*/package.json for
// `gwd.linkable === true`. This is the single source of truth — the same list
// read by scripts/link-workspace-packages.cjs and scripts/validate-pack.js.
// Adding a new linkable package requires only setting `gwd.linkable` in its
// package.json; there is no enumeration to keep in sync here.
const packagesDir = join(gsdRoot, 'packages')
type WsPkg = { dir: string; scope: string; name: string }
const wsPackages: WsPkg[] = []
try {
  if (existsSync(packagesDir)) {
    for (const dir of readdirSync(packagesDir)) {
      const pkgPath = join(packagesDir, dir)
      if (!statSync(pkgPath).isDirectory()) continue
      const pkgJsonPath = join(pkgPath, 'package.json')
      if (!existsSync(pkgJsonPath)) continue
      try {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
        const gwd = pkg.gwd
        if (!gwd || gwd.linkable !== true) continue
        if (gwd.scope && gwd.name) wsPackages.push({ dir, scope: gwd.scope, name: gwd.name })
      } catch { /* ignore malformed package.json */ }
    }
  }
} catch { /* non-fatal — validation below catches missing critical packages */ }

try {
  for (const pkg of wsPackages) {
    const scopeDir = join(gsdNodeModules, pkg.scope)
    if (!existsSync(scopeDir)) mkdirSync(scopeDir, { recursive: true })
    const target = join(scopeDir, pkg.name)
    const source = join(packagesDir, pkg.dir)
    if (!existsSync(source) || existsSync(target)) continue
    try {
      symlinkSync(source, target, 'junction')
    } catch {
      // Symlink failed (common on Windows without Developer Mode / admin).
      // Fall back to a directory copy — slower on first run but universally works.
      try { cpSync(source, target, { recursive: true }) } catch { /* non-fatal */ }
    }
  }
} catch { /* non-fatal */ }

const gwdScopeDir = join(gsdNodeModules, '@gwd')

// Validate critical workspace packages are resolvable. If still missing after the
// symlink+copy attempts, emit a clear diagnostic instead of a cryptic
// ERR_MODULE_NOT_FOUND from deep inside cli.js.
const criticalPackages = ['pi-coding-agent']
const missingPackages = criticalPackages.filter(pkg => !existsSync(join(gwdScopeDir, pkg)))
if (missingPackages.length > 0) {
  const missing = missingPackages.map(p => `@gwd/${p}`).join(', ')
  process.stderr.write(
    `\nError: ${PRODUCT_DISPLAY_NAME} installation is broken — missing packages: ${missing}\n\n` +
    `This is usually caused by one of:\n` +
    `  • An outdated version installed from npm (run: npm install -g ${PRODUCT_PACKAGE_NAME}@latest)\n` +
    `  • The packages/ directory was excluded from the installed tarball\n` +
    `  • A filesystem error prevented linking or copying the workspace packages\n\n` +
    `Fix it by reinstalling:\n\n` +
    `  npm install -g ${PRODUCT_PACKAGE_NAME}@latest\n\n` +
    `If the issue persists, please open an issue at:\n` +
    `  https://github.com/gwd-build/gwd-2/issues\n`
  )
  process.exit(1)
}

// Dynamic import defers ESM evaluation — config.js will see PI_PACKAGE_DIR above
await import('./cli.js')
