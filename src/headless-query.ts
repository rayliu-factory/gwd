/**
 * Headless Query — `gwd headless query`
 *
 * Single read-only command that returns the full project snapshot as JSON
 * to stdout, without spawning an LLM session. Instant (~50ms).
 *
 * Output: { state, next, cost }
 *   state — deriveState() output (phase, milestones, progress, blockers)
 *   next  — dry-run dispatch preview (what auto-mode would do next)
 *   cost  — aggregated parallel worker costs
 *
 * Note: Extension modules are .ts files loaded via jiti (not compiled to .js).
 * We use createJiti() here because this module is imported directly from cli.ts,
 * bypassing the extension loader's jiti setup (#1137).
 */

import { createJiti } from '@mariozechner/jiti'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { GWDState } from './resources/extensions/gwd/types.js'
import { resolveBundledGwdExtensionModule } from './bundled-resource-path.js'

const jiti = createJiti(fileURLToPath(import.meta.url), { interopDefault: true, debug: false })
const { existsSync } = await import('node:fs')

/**
 * Resolve the GWD extensions root for headless-query. Prefers the synced
 * agent directory (so headless-query loads the same extension copy as
 * interactive/auto modes — #3471) and falls back to the bundled source
 * resource for source-tree dev workflows.
 *
 * Pure on the given inputs (env + fs probe + bundled resolver) so the
 * #3471 contract can be exercised in tests without spawning a subprocess.
 */
export function resolveGwdAgentExtensionsDir(env: NodeJS.ProcessEnv = process.env): string {
  const agentRoot = env.GWD_AGENT_DIR || join(env.GWD_HOME || join(homedir(), '.gwd'), 'agent')
  return join(agentRoot, 'extensions', 'gwd')
}

/**
 * Decide whether headless-query should load extensions from the agent
 * sync directory (#3471) or fall back to bundled source. Returns the
 * agent dir alongside the decision so a caller can use it directly.
 */
const headlessQueryExtensionModules = [
  'state',
  'auto-dispatch',
  'session-status-io',
  'preferences',
  'auto-start',
]

function hasExtensionModule(agentDir: string, moduleName: string, fileExists: (path: string) => boolean): boolean {
  return fileExists(join(agentDir, `${moduleName}.ts`)) || fileExists(join(agentDir, `${moduleName}.js`))
}

export function shouldUseAgentExtensionsDir(opts: {
  env?: NodeJS.ProcessEnv
  fileExists?: (path: string) => boolean
}): { agentDir: string; useAgentDir: boolean } {
  const env = opts.env ?? process.env
  const fileExists = opts.fileExists ?? existsSync
  const agentDir = resolveGwdAgentExtensionsDir(env)
  return {
    agentDir,
    useAgentDir: headlessQueryExtensionModules.every((moduleName) =>
      hasExtensionModule(agentDir, moduleName, fileExists),
    ),
  }
}

const gwdExtensionPath = (...segments: string[]) => {
  const { agentDir, useAgentDir } = shouldUseAgentExtensionsDir({ env: process.env })
  return useAgentDir
    ? resolveAgentExtensionModule(agentDir, segments)
    : resolveBundledGwdExtensionModule(import.meta.url, segments.join('/'))
}

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
  const dispatchModule = await jiti.import(gwdExtensionPath('auto-dispatch.ts'), {}) as any
  const sessionModule = await jiti.import(gwdExtensionPath('session-status-io.ts'), {}) as any
  const prefsModule = await jiti.import(gwdExtensionPath('preferences.ts'), {}) as any
  const autoStartModule = await jiti.import(gwdExtensionPath('auto-start.ts'), {}) as any
  return {
    openProjectDbIfPresent: autoStartModule.openProjectDbIfPresent as (basePath: string) => Promise<void>,
    deriveState: stateModule.deriveState as (basePath: string) => Promise<GWDState>,
    resolveDispatch: dispatchModule.resolveDispatch as (opts: any) => Promise<any>,
    readAllSessionStatuses: sessionModule.readAllSessionStatuses as (basePath: string) => any[],
    loadEffectiveGWDPreferences: prefsModule.loadEffectiveGWDPreferences as () => any,
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface QuerySnapshot {
  state: GWDState
  next: {
    action: 'dispatch' | 'stop' | 'skip'
    unitType?: string
    unitId?: string
    reason?: string
  }
  cost: {
    workers: Array<{
      milestoneId: string
      pid: number
      state: string
      cost: number
      lastHeartbeat: number
    }>
    total: number
  }
}

export interface QueryResult {
  exitCode: number
  data?: QuerySnapshot
}

// ─── Implementation ─────────────────────────────────────────────────────────

type HeadlessQueryModules = Awaited<ReturnType<typeof loadExtensionModules>>

export async function runHeadlessQuery(
  basePath: string,
  modules: HeadlessQueryModules,
  writeOutput: (text: string) => void = (text) => process.stdout.write(text),
): Promise<QueryResult> {
  const {
    openProjectDbIfPresent,
    deriveState,
    resolveDispatch,
    readAllSessionStatuses,
    loadEffectiveGWDPreferences,
  } = modules
  await openProjectDbIfPresent(basePath)
  const state = await deriveState(basePath)

  // Derive next dispatch action
  let next: QuerySnapshot['next']
  if (!state.activeMilestone?.id) {
    next = {
      action: 'stop',
      reason: state.phase === 'complete' ? 'All milestones complete.' : state.nextAction,
    }
  } else {
    const loaded = loadEffectiveGWDPreferences()
    const dispatch = await resolveDispatch({
      basePath,
      mid: state.activeMilestone.id,
      midTitle: state.activeMilestone.title,
      state,
      prefs: loaded?.preferences,
    })
    next = {
      action: dispatch.action,
      unitType: dispatch.action === 'dispatch' ? dispatch.unitType : undefined,
      unitId: dispatch.action === 'dispatch' ? dispatch.unitId : undefined,
      reason: dispatch.action === 'stop' ? dispatch.reason : undefined,
    }
  }

  // Aggregate parallel worker costs
  const statuses = readAllSessionStatuses(basePath)
  const workers = statuses.map((s) => ({
    milestoneId: s.milestoneId,
    pid: s.pid,
    state: s.state,
    cost: s.cost,
    lastHeartbeat: s.lastHeartbeat,
  }))

  const snapshot: QuerySnapshot = {
    state,
    next,
    cost: { workers, total: workers.reduce((sum, w) => sum + w.cost, 0) },
  }

  writeOutput(JSON.stringify(snapshot) + '\n')
  return { exitCode: 0, data: snapshot }
}

export async function handleQuery(basePath: string): Promise<QueryResult> {
  return runHeadlessQuery(basePath, await loadExtensionModules())
}
