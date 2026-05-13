import { test } from "node:test";
import assert from "node:assert/strict";

import { extractSetupCommandArgs, runSetupCommand } from "../setup-command.ts";

test("extractSetupCommandArgs preserves helper flags that overlap top-level CLI flags", () => {
  assert.deepEqual(
    extractSetupCommandArgs([
      "node",
      "gwd",
      "setup",
      "vllm-metal-qwen36",
      "--model",
      "both",
      "--models-json",
    ]),
    ["vllm-metal-qwen36", "--model", "both", "--models-json"],
  );
});

test("setup command delegates vllm-metal-qwen36 args to the helper", async () => {
  const calls: string[][] = [];
  const exitCode = await runSetupCommand(
    ["vllm-metal-qwen36", "--model", "both", "--models-json"],
    {
      loadVllmMetalQwen36Helper: async () => ({
        main(argv: string[]) {
          calls.push(argv);
          return 0;
        },
      }),
      stderr: { write() { return true; } },
    },
  );

  assert.equal(exitCode, 0);
  assert.deepEqual(calls, [["--model", "both", "--models-json"]]);
});

test("setup command rejects unknown setup helpers", async () => {
  let stderr = "";
  const exitCode = await runSetupCommand(
    ["unknown"],
    {
      loadVllmMetalQwen36Helper: async () => ({
        main() {
          throw new Error("helper should not be loaded");
        },
      }),
      stderr: { write(chunk: string) { stderr += chunk; return true; } },
    },
  );

  assert.equal(exitCode, 1);
  assert.match(stderr, /Unknown setup command: unknown/);
  assert.match(stderr, /Commands:/);
  assert.match(stderr, /vllm-metal-qwen36/);
});
