#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { totalmem } from "node:os";
import { fileURLToPath } from "node:url";

export const DEFAULT_MAX_MODEL_LEN = 196_608;
export const DEFAULT_MAX_TOKENS = 16_384;
export const DEFAULT_K_QUANT = "q8_0";
export const DEFAULT_V_QUANT = "q3_0";
export const VLLM_METAL_INSTALL_DOCS = "https://docs.vllm.ai/projects/vllm-metal/en/latest/installation/";
export const VLLM_METAL_TURBOQUANT_DOCS = "https://docs.vllm.ai/projects/vllm-metal/en/latest/turboquant/";

export const MODEL_PROFILES = {
  "27b": {
    label: "Qwen3.6 27B FP8",
    provider: "vllm-metal-27b",
    modelId: "Qwen/Qwen3.6-27B-FP8",
    defaultPort: 8000,
    name: "Qwen3.6 27B FP8 (vLLM Metal TurboQuant)",
  },
  "35b": {
    label: "Qwen3.6 35B-A3B FP8",
    provider: "vllm-metal-35b",
    modelId: "Qwen/Qwen3.6-35B-A3B-FP8",
    defaultPort: 8001,
    name: "Qwen3.6 35B-A3B FP8 (vLLM Metal TurboQuant)",
  },
};

const USAGE = `Usage:
  node scripts/setup-vllm-metal-qwen36-turboquant.mjs [options]
  npm run setup:vllm-metal-qwen36 -- [options]

Options:
  --model 27b|35b|both     Select the server command to print. Defaults to 27b.
  --both                   Alias for --model both.
  --start [27b|35b]        Start one selected long-running vLLM server.
  --models-json            Include a ~/.gwd/agent/models.json example.
  --host HOST              Bind host. Defaults to 127.0.0.1.
  --port PORT              Override the selected single-model port.
  --port27 PORT            Override the 27B port. Defaults to 8000.
  --port35 PORT            Override the 35B-A3B port. Defaults to 8001.
  --max-model-len TOKENS   Defaults to 196608 for the 48GB profile.
  --k-quant VALUE          Defaults to q8_0.
  --v-quant VALUE          Defaults to q3_0.
  --vllm-bin PATH          vLLM executable. Defaults to vllm.
  --help                   Show this help.

Examples:
  npm run setup:vllm-metal-qwen36
  npm run setup:vllm-metal-qwen36 -- --model both --models-json
  npm run setup:vllm-metal-qwen36 -- --start 27b
  npm run setup:vllm-metal-qwen36 -- --start 35b --port 8001
`;

function defaultOptions() {
  return {
    host: "127.0.0.1",
    port27: MODEL_PROFILES["27b"].defaultPort,
    port35: MODEL_PROFILES["35b"].defaultPort,
    maxModelLen: DEFAULT_MAX_MODEL_LEN,
    maxTokens: DEFAULT_MAX_TOKENS,
    kQuant: DEFAULT_K_QUANT,
    vQuant: DEFAULT_V_QUANT,
    vllmBin: "vllm",
  };
}

function normalizeModel(value) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "27" || normalized === "27b") return "27b";
  if (normalized === "35" || normalized === "35b" || normalized === "35b-a3b") return "35b";
  if (normalized === "both" || normalized === "all") return "both";
  throw new Error(`unknown model "${value}"; expected 27b, 35b, or both`);
}

function parsePositiveInteger(name, value) {
  if (value === undefined || value.startsWith("-")) {
    throw new Error(`${name} requires a positive integer value`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function readValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("-")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseArgs(argv) {
  const options = defaultOptions();
  let model = "27b";
  let start = false;
  let printModelsJson = false;
  let help = false;
  let portOverride;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        help = true;
        break;
      case "--model":
        model = normalizeModel(readValue(argv, i, arg));
        i++;
        break;
      case "--both":
        model = "both";
        break;
      case "--start":
        start = true;
        if (argv[i + 1] && !argv[i + 1].startsWith("-")) {
          model = normalizeModel(argv[i + 1]);
          i++;
        }
        break;
      case "--models-json":
        printModelsJson = true;
        break;
      case "--host":
        options.host = readValue(argv, i, arg);
        i++;
        break;
      case "--port":
        portOverride = parsePositiveInteger(arg, readValue(argv, i, arg));
        i++;
        break;
      case "--port27":
        options.port27 = parsePositiveInteger(arg, readValue(argv, i, arg));
        i++;
        break;
      case "--port35":
        options.port35 = parsePositiveInteger(arg, readValue(argv, i, arg));
        i++;
        break;
      case "--max-model-len":
        options.maxModelLen = parsePositiveInteger(arg, readValue(argv, i, arg));
        i++;
        break;
      case "--k-quant":
        options.kQuant = readValue(argv, i, arg);
        i++;
        break;
      case "--v-quant":
        options.vQuant = readValue(argv, i, arg);
        i++;
        break;
      case "--vllm-bin":
        options.vllmBin = readValue(argv, i, arg);
        i++;
        break;
      default:
        throw new Error(`unknown option "${arg}"`);
    }
  }

  if (portOverride !== undefined) {
    if (model === "both") throw new Error("--port is ambiguous with --model both; use --port27 and --port35");
    if (model === "35b") options.port35 = portOverride;
    else options.port27 = portOverride;
  }

  const models = model === "both" ? ["27b", "35b"] : [model];
  if (start && models.length > 1) {
    throw new Error("cannot --start both long-running servers in one helper process; start each model in a separate terminal");
  }

  return { help, start, printModelsJson, models, options };
}

function profileFor(model) {
  const profile = MODEL_PROFILES[model];
  if (!profile) throw new Error(`unknown model "${model}"`);
  return profile;
}

function portFor(model, options) {
  return model === "35b" ? options.port35 : options.port27;
}

export function buildServeCommand(model, partialOptions = {}) {
  const options = { ...defaultOptions(), ...partialOptions };
  const profile = profileFor(model);
  const additionalConfig = JSON.stringify({
    turboquant: true,
    k_quant: options.kQuant,
    v_quant: options.vQuant,
  });

  return {
    bin: options.vllmBin,
    env: { VLLM_METAL_USE_PAGED_ATTENTION: "1" },
    args: [
      "serve",
      profile.modelId,
      "--host",
      options.host,
      "--port",
      String(portFor(model, options)),
      "--max-model-len",
      String(options.maxModelLen),
      "--reasoning-parser",
      "qwen3",
      "--additional-config",
      additionalConfig,
    ],
  };
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, "'\\''")}'`;
}

export function renderCommand(command) {
  const env = Object.entries(command.env)
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join(" ");
  const headArgs = command.args.slice(0, 2).map(shellQuote).join(" ");
  const lines = [`${env} ${shellQuote(command.bin)} ${headArgs} \\`];
  for (let i = 2; i < command.args.length; i += 2) {
    const flag = command.args[i];
    const value = command.args[i + 1];
    const suffix = i + 2 < command.args.length ? " \\" : "";
    lines.push(`  ${shellQuote(flag)} ${shellQuote(value)}${suffix}`);
  }
  return lines.join("\n");
}

function baseUrl(host, port) {
  const formattedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  return `http://${formattedHost}:${port}/v1`;
}

function providerFor(model, options) {
  const profile = profileFor(model);
  return {
    baseUrl: baseUrl(options.host, portFor(model, options)),
    api: "openai-completions",
    apiKey: "vllm",
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      supportsUsageInStreaming: false,
      thinkingFormat: "qwen",
    },
    models: [
      {
        id: profile.modelId,
        name: profile.name,
        reasoning: true,
        input: ["text"],
        contextWindow: options.maxModelLen,
        maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      },
    ],
  };
}

export function buildModelsJson(partialOptions = {}) {
  const options = { ...defaultOptions(), ...partialOptions };
  return {
    providers: {
      [MODEL_PROFILES["27b"].provider]: providerFor("27b", options),
      [MODEL_PROFILES["35b"].provider]: providerFor("35b", options),
    },
  };
}

export function inspectMachine(deps = {}) {
  const platform = deps.platform ?? process.platform;
  const arch = deps.arch ?? process.arch;
  const memoryBytes = typeof deps.totalmem === "function" ? deps.totalmem() : totalmem();
  const memoryGb = Math.round(memoryBytes / 1024 ** 3);
  let cpuBrand = "";

  if (platform === "darwin") {
    try {
      const exec = deps.execFileSync ?? execFileSync;
      cpuBrand = String(exec("sysctl", ["-n", "machdep.cpu.brand_string"], { encoding: "utf8" })).trim();
    } catch {
      cpuBrand = "";
    }
  }

  const isAppleSiliconMac = platform === "darwin" && arch === "arm64";
  const memoryMatches = memoryGb >= 44 && memoryGb <= 56;
  const cpuMatches = /Apple M\d+\s*Pro/i.test(cpuBrand);
  const warnings = [];

  if (!isAppleSiliconMac) warnings.push("This helper is tuned for Apple Silicon macOS hosts.");
  if (!memoryMatches) warnings.push(`Detected ${memoryGb}GB memory; the default profile is tuned for a 48GB machine.`);
  if (cpuBrand && !cpuMatches) warnings.push(`Detected CPU "${cpuBrand}", not an Apple M-series Pro label.`);

  return {
    platform,
    arch,
    memoryGb,
    cpuBrand,
    isAppleSiliconMac,
    matchesTargetProfile: isAppleSiliconMac && memoryMatches && (!cpuBrand || cpuMatches),
    warnings,
  };
}

function hasCommand(bin) {
  const lookup = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(lookup, [bin], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return result.status === 0;
}

function renderMachine(machine) {
  const cpu = machine.cpuBrand ? `, ${machine.cpuBrand}` : "";
  return `${machine.platform}/${machine.arch}, ${machine.memoryGb}GB${cpu}`;
}

export function renderDryRun(parsed, deps = {}) {
  const machine = deps.machine ?? inspectMachine();
  const vllmAvailable = deps.vllmAvailable ?? hasCommand(parsed.options.vllmBin);
  const lines = [
    "GWD vLLM Metal TurboQuant Qwen3.6 helper",
    "",
    `Detected: ${renderMachine(machine)}`,
    `vLLM CLI: ${vllmAvailable ? "found" : `not found at ${parsed.options.vllmBin}`}`,
  ];

  if (machine.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of machine.warnings) lines.push(`  - ${warning}`);
  }

  if (!vllmAvailable) {
    lines.push("", "Install vLLM Metal first:");
    lines.push(`  ${VLLM_METAL_INSTALL_DOCS}`);
  }

  lines.push("", "Start command:");
  for (const model of parsed.models) {
    const profile = profileFor(model);
    lines.push("", `# ${profile.label}`);
    lines.push(renderCommand(buildServeCommand(model, parsed.options)));
  }

  lines.push("");
  lines.push("GWD auto-detects the default local OpenAI-compatible URLs on ports 8000 and 8001.");
  lines.push("The 48GB recommendation is to start 27B by default and start 35B-A3B only when you want a separate heavy endpoint.");
  lines.push(`TurboQuant reference: ${VLLM_METAL_TURBOQUANT_DOCS}`);

  if (parsed.printModelsJson) {
    lines.push("", "models.json example for custom ports:", JSON.stringify(buildModelsJson(parsed.options), null, 2));
  }

  return lines.join("\n");
}

function runStart(parsed) {
  const model = parsed.models[0];
  const machine = inspectMachine();
  for (const warning of machine.warnings) process.stderr.write(`warning: ${warning}\n`);

  const command = buildServeCommand(model, parsed.options);
  process.stderr.write(`${renderCommand(command)}\n`);
  const result = spawnSync(command.bin, command.args, {
    stdio: "inherit",
    env: { ...process.env, ...command.env },
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      process.stderr.write(`error: could not find ${command.bin}; install vLLM Metal first: ${VLLM_METAL_INSTALL_DOCS}\n`);
    } else {
      process.stderr.write(`error: failed to start ${command.bin}: ${result.error.message}\n`);
    }
    return 1;
  }
  return result.status ?? 1;
}

export function main(argv = process.argv.slice(2)) {
  try {
    const parsed = parseArgs(argv);
    if (parsed.help) {
      process.stdout.write(USAGE);
      return 0;
    }
    if (parsed.start) return runStart(parsed);
    process.stdout.write(`${renderDryRun(parsed)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n\n${USAGE}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
