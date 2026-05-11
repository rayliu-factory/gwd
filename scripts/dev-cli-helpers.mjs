// GWD2 - Dev CLI child-process spawn helpers.

export function buildDevCliSpawnArgs({
  resolveTsPath,
  srcLoaderPath,
  argv,
}) {
  return ['--import', resolveTsPath, '--experimental-strip-types', srcLoaderPath, ...argv]
}

export function buildDevCliChildEnv(baseEnv, devCliPath) {
  return {
    ...baseEnv,
    // Child GWD processes (subagents, parallel workers, workflow MCP)
    // must re-enter through this wrapper so source-mode TS imports keep
    // using resolve-ts. Pointing them at src/loader.ts directly makes Node
    // resolve .js specifiers without the TS resolver.
    GWD_DEV_CLI_PATH: devCliPath,
    GWD_CLI_PATH: devCliPath,
    GWD_BIN_PATH: devCliPath,
  }
}
