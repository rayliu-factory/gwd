// GSD-2 - Loader child-process entrypoint resolution helpers.

import { existsSync as defaultExistsSync } from "node:fs"
import { join, resolve } from "node:path"

export interface LoaderEntrypointOptions {
  gsdRoot: string
  invokedBinPath: string | undefined
  env?: NodeJS.ProcessEnv
  existsSync?: (path: string) => boolean
}

export function resolveLoaderCliEntrypoint({
  gsdRoot,
  invokedBinPath,
  env = process.env,
  existsSync = defaultExistsSync,
}: LoaderEntrypointOptions): string | undefined {
  const sourceLoaderPath = join(gsdRoot, "src", "loader.ts")
  const devCliPath = env.GWD_DEV_CLI_PATH?.trim() || join(gsdRoot, "scripts", "dev-cli.js")
  const explicitCliPath = env.GWD_CLI_PATH?.trim() || env.GWD_BIN_PATH?.trim()
  const isSourceLoader = Boolean(invokedBinPath && resolve(invokedBinPath) === sourceLoaderPath)
  const rawGsdBinPath = explicitCliPath || (isSourceLoader && existsSync(devCliPath) ? devCliPath : invokedBinPath)
  return rawGsdBinPath ? resolve(rawGsdBinPath) : undefined
}

export function applyLoaderCliEntrypointEnv(env: NodeJS.ProcessEnv, options: LoaderEntrypointOptions): string | undefined {
  const resolvedGsdBinPath = resolveLoaderCliEntrypoint({ ...options, env })
  if (resolvedGsdBinPath) {
    env.GWD_BIN_PATH = resolvedGsdBinPath
    if (!env.GWD_CLI_PATH) {
      env.GWD_CLI_PATH = resolvedGsdBinPath
    }
  } else {
    delete env.GWD_BIN_PATH
    if (!env.GWD_CLI_PATH) {
      delete env.GWD_CLI_PATH
    }
  }
  return resolvedGsdBinPath
}
