import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildModelsJson,
  buildServeCommand,
  inspectMachine,
  parseArgs,
  renderCommand,
} from "../setup-vllm-metal-qwen36-turboquant.mjs";

test("buildServeCommand uses the 48GB TurboQuant profile for Qwen3.6 27B", () => {
  const command = buildServeCommand("27b", {});

  assert.equal(command.env.VLLM_METAL_USE_PAGED_ATTENTION, "1");
  assert.equal(command.bin, "vllm");
  assert.deepEqual(command.args, [
    "serve",
    "Qwen/Qwen3.6-27B-FP8",
    "--host",
    "127.0.0.1",
    "--port",
    "8000",
    "--max-model-len",
    "196608",
    "--reasoning-parser",
    "qwen3",
    "--additional-config",
    '{"turboquant":true,"k_quant":"q8_0","v_quant":"q3_0"}',
  ]);

  const rendered = renderCommand(command);
  assert.match(rendered, /^VLLM_METAL_USE_PAGED_ATTENTION=1 vllm serve Qwen\/Qwen3\.6-27B-FP8/);
  assert.match(rendered, /--additional-config '\{"turboquant":true,"k_quant":"q8_0","v_quant":"q3_0"\}'/);
});

test("buildServeCommand uses a separate default port for Qwen3.6 35B-A3B", () => {
  const command = buildServeCommand("35b", {});

  assert.deepEqual(command.args.slice(0, 2), ["serve", "Qwen/Qwen3.6-35B-A3B-FP8"]);
  assert.equal(command.args[command.args.indexOf("--port") + 1], "8001");
});

test("parseArgs supports a two-endpoint dry run and custom ports", () => {
  const parsed = parseArgs([
    "--model",
    "both",
    "--port27",
    "8100",
    "--port35",
    "8101",
    "--max-model-len",
    "131072",
    "--models-json",
  ]);

  assert.deepEqual(parsed.models, ["27b", "35b"]);
  assert.equal(parsed.start, false);
  assert.equal(parsed.printModelsJson, true);
  assert.equal(parsed.options.port27, 8100);
  assert.equal(parsed.options.port35, 8101);
  assert.equal(parsed.options.maxModelLen, 131072);
});

test("parseArgs rejects starting both long-running servers in one process", () => {
  assert.throws(() => parseArgs(["--model", "both", "--start"]), /cannot --start both/);
});

test("buildModelsJson emits GWD OpenAI-compatible providers for custom ports", () => {
  const modelsJson = buildModelsJson({
    host: "127.0.0.1",
    port27: 8100,
    port35: 8101,
    maxModelLen: 131072,
  });

  assert.equal(modelsJson.providers["vllm-metal-27b"].baseUrl, "http://127.0.0.1:8100/v1");
  assert.equal(modelsJson.providers["vllm-metal-35b"].baseUrl, "http://127.0.0.1:8101/v1");
  assert.equal(modelsJson.providers["vllm-metal-27b"].models[0].id, "Qwen/Qwen3.6-27B-FP8");
  assert.equal(modelsJson.providers["vllm-metal-35b"].models[0].id, "Qwen/Qwen3.6-35B-A3B-FP8");
  assert.equal(modelsJson.providers["vllm-metal-27b"].models[0].contextWindow, 131072);
  assert.equal(modelsJson.providers["vllm-metal-35b"].models[0].contextWindow, 131072);
  assert.equal(modelsJson.providers["vllm-metal-27b"].compat.thinkingFormat, "qwen");
});

test("inspectMachine recognizes a 48GB M5 Pro Apple Silicon host", () => {
  const machine = inspectMachine({
    platform: "darwin",
    arch: "arm64",
    totalmem: () => 48 * 1024 ** 3,
    execFileSync: () => "Apple M5 Pro\n",
  });

  assert.equal(machine.isAppleSiliconMac, true);
  assert.equal(machine.memoryGb, 48);
  assert.equal(machine.cpuBrand, "Apple M5 Pro");
  assert.equal(machine.matchesTargetProfile, true);
});
