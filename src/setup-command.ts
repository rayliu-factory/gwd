export interface VllmMetalQwen36Helper {
  main(argv: string[]): number
}

interface WritableLike {
  write(chunk: string): unknown
}

export interface SetupCommandDeps {
  loadVllmMetalQwen36Helper?: () => Promise<VllmMetalQwen36Helper>
  stdout?: WritableLike
  stderr?: WritableLike
}

const SETUP_USAGE = [
  'Usage: gwd setup <command> [options]',
  '',
  'Commands:',
  '  vllm-metal-qwen36    Print or start the vLLM Metal TurboQuant Qwen3.6 profile helper',
  '',
  'Examples:',
  '  gwd setup vllm-metal-qwen36',
  '  gwd setup vllm-metal-qwen36 --model both --models-json',
  '  gwd setup vllm-metal-qwen36 --start 27b',
].join('\n')

async function loadDefaultVllmMetalQwen36Helper(): Promise<VllmMetalQwen36Helper> {
  const helperUrl = new URL('../scripts/setup-vllm-metal-qwen36-turboquant.mjs', import.meta.url)
  const helper = await import(helperUrl.href) as unknown as VllmMetalQwen36Helper
  return helper
}

function isHelpArg(arg: string | undefined): boolean {
  return arg === '--help' || arg === '-h'
}

export function extractSetupCommandArgs(argv: string[]): string[] {
  const setupIndex = argv.slice(2).indexOf('setup')
  if (setupIndex === -1) return []
  return argv.slice(setupIndex + 3)
}

export async function runSetupCommand(args: string[], deps: SetupCommandDeps = {}): Promise<number> {
  const stdout = deps.stdout ?? process.stdout
  const stderr = deps.stderr ?? process.stderr
  const loadVllmMetalQwen36Helper = deps.loadVllmMetalQwen36Helper ?? loadDefaultVllmMetalQwen36Helper
  const command = args[0]

  if (!command || isHelpArg(command)) {
    stdout.write(`${SETUP_USAGE}\n`)
    return 0
  }

  if (command === 'vllm-metal-qwen36') {
    const helper = await loadVllmMetalQwen36Helper()
    return helper.main(args.slice(1))
  }

  stderr.write(`Unknown setup command: ${command}\n\n${SETUP_USAGE}\n`)
  return 1
}
