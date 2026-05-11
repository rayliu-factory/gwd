// GWD-2 - Loader child-process entrypoint resolution helpers.

import { existsSync as defaultExistsSync } from "node:fs"
import { join, resolve } from "node:path"

export interface LoaderEntrypointOptions {
  gwdRoot: string
  invokedBinPath: string | undefined
  env?: NodeJS.ProcessEnv
  existsSync?: (path: string) => boolean
}

export function resolveLoaderCliEntrypoint({
  gwdRoot,
  invokedBinPath,
  env = process.env,
  existsSync = defaultExistsSync,
}: LoaderEntrypointOptions): string | undefined {
  const sourceLoaderPath = join(gwdRoot, "src", "loader.ts")
  const devCliPath = env.GWD_DEV_CLI_PATH?.trim() || join(gwdRoot, "scripts", "dev-cli.js")
  const explicitCliPath = env.GWD_CLI_PATH?.trim() || env.GWD_BIN_PATH?.trim()
  const isSourceLoader = Boolean(invokedBinPath && resolve(invokedBinPath) === sourceLoaderPath)
  const rawGwdBinPath = explicitCliPath || (isSourceLoader && existsSync(devCliPath) ? devCliPath : invokedBinPath)
  return rawGwdBinPath ? resolve(rawGwdBinPath) : undefined
}

export function applyLoaderCliEntrypointEnv(env: NodeJS.ProcessEnv, options: LoaderEntrypointOptions): string | undefined {
  const resolvedGwdBinPath = resolveLoaderCliEntrypoint({ ...options, env })
  if (resolvedGwdBinPath) {
    env.GWD_BIN_PATH = resolvedGwdBinPath
    if (!env.GWD_CLI_PATH) {
      env.GWD_CLI_PATH = resolvedGwdBinPath
    }
  } else {
    delete env.GWD_BIN_PATH
    if (!env.GWD_CLI_PATH) {
      delete env.GWD_CLI_PATH
    }
  }
  return resolvedGwdBinPath
}
