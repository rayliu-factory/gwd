// gwd-pi — Headless Recover entrypoint
/**
 * Headless Recover — `gwd headless recover`
 *
 * Non-interactive parallel of the `/gwd recover` slash command. Clears the
 * milestones / slices / tasks tables and re-imports them from the on-disk
 * markdown projections (ROADMAP.md, PLAN.md, SUMMARY.md, …) via
 * migrateHierarchyToDb. Mutating: this is the one headless subcommand that
 * writes to the DB. Required for CI / automation flows that need to
 * reconcile DB state from markdown without launching an LLM session or a
 * TTY-bound interactive runtime.
 *
 * Output: `gwd-recover: recovered <N>M/<N>S/<N>T hierarchy\n` to stderr on
 * success — same marker emitted by handleRecover (commands-maintenance.ts)
 * so callers can distinguish the success path from a silent no-op.
 *
 * Exit codes:
 *   0 — recovery succeeded
 *   1 — `.gwd/` missing, DB could not be opened, or migration threw
 */

import { createJiti } from '@mariozechner/jiti'
import { fileURLToPath } from 'node:url'
import { resolveGwdAgentExtensionsDir, shouldUseAgentExtensionsDir } from './headless-query.js'
import { resolveBundledGwdExtensionModule } from './bundled-resource-path.js'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

const jiti = createJiti(fileURLToPath(import.meta.url), { interopDefault: true, debug: false })

const agentExtensionsDir = resolveGwdAgentExtensionsDir()
const { useAgentDir } = shouldUseAgentExtensionsDir({ env: process.env })
const gwdExtensionPath = (...segments: string[]) =>
  useAgentDir
    ? resolveAgentExtensionModule(agentExtensionsDir, segments)
    : resolveBundledGwdExtensionModule(import.meta.url, segments.join('/'))

function resolveAgentExtensionModule(agentDir: string, segments: string[]): string {
  const requested = join(agentDir, ...segments)
  if (existsSync(requested)) return requested
  if (segments.length === 1 && segments[0].endsWith('.ts')) {
    const jsPath = join(agentDir, segments[0].replace(/\.ts$/, '.js'))
    if (existsSync(jsPath)) return jsPath
  }
  return requested
}

async function loadExtensionModules() {
  const stateModule = await jiti.import(gwdExtensionPath('state.ts'), {}) as any
  const dbModule = await jiti.import(gwdExtensionPath('gwd-db.ts'), {}) as any
  const importerModule = await jiti.import(gwdExtensionPath('md-importer.ts'), {}) as any
  const dynamicToolsModule = await jiti.import(gwdExtensionPath('bootstrap/dynamic-tools.ts'), {}) as any
  return {
    ensureDbOpen: dynamicToolsModule.ensureDbOpen as (basePath: string) => Promise<boolean>,
    isDbAvailable: dbModule.isDbAvailable as () => boolean,
    clearEngineHierarchy: dbModule.clearEngineHierarchy as () => void,
    transaction: dbModule.transaction as <T>(fn: () => T) => T,
    migrateHierarchyToDb: importerModule.migrateHierarchyToDb as (basePath: string) =>
      { milestones: number; slices: number; tasks: number },
    invalidateStateCache: stateModule.invalidateStateCache as () => void,
  }
}

export interface RecoverResult {
  exitCode: number
}

export async function handleRecover(basePath: string): Promise<RecoverResult> {
  const gwdDir = join(basePath, '.gwd')
  if (!existsSync(gwdDir)) {
    process.stderr.write(`[headless] recover: no .gwd/ directory at ${basePath}\n`)
    return { exitCode: 1 }
  }

  let modules: Awaited<ReturnType<typeof loadExtensionModules>>
  try {
    modules = await loadExtensionModules()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[headless] recover: failed to load extension modules: ${msg}\n`)
    return { exitCode: 1 }
  }

  const opened = await modules.ensureDbOpen(basePath)
  if (!opened || !modules.isDbAvailable()) {
    process.stderr.write(`[headless] recover: failed to open or create the GWD database at ${basePath}\n`)
    return { exitCode: 1 }
  }

  let counts: { milestones: number; slices: number; tasks: number }
  try {
    counts = modules.transaction(() => {
      modules.clearEngineHierarchy()
      return modules.migrateHierarchyToDb(basePath)
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[headless] recover failed: ${msg}\n`)
    return { exitCode: 1 }
  }

  modules.invalidateStateCache()

  process.stderr.write(
    `gwd-recover: recovered ${counts.milestones}M/${counts.slices}S/${counts.tasks}T hierarchy\n`,
  )
  return { exitCode: 0 }
}
