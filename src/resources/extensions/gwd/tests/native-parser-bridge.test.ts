import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bridgePath = fileURLToPath(new URL("../native-parser-bridge.ts", import.meta.url));
const packageTestRunnerPath = fileURLToPath(new URL("../../../../../scripts/run-package-tests.cjs", import.meta.url));

const staleNamespace = "G" + "sd";
const staleBatchParser = `batchParse${staleNamespace}Files`;
const staleNativeBatchParser = `nativeBatchParse${staleNamespace}Files`;
const staleTreeEntry = `${staleNamespace}TreeEntry`;
const staleNativeEngine = "g" + "sd" + "_engine";

test("native parser bridge uses GWD batch parser export names", () => {
  const source = readFileSync(bridgePath, "utf8");

  assert.match(source, /batchParseGwdFiles/);
  assert.match(source, /nativeBatchParseGwdFiles/);
  assert.match(source, /GwdTreeEntry/);
  assert.doesNotMatch(source, new RegExp(staleBatchParser));
  assert.doesNotMatch(source, new RegExp(staleNativeBatchParser));
  assert.doesNotMatch(source, new RegExp(staleTreeEntry));
});

test("package test runner probes GWD native addon artifacts", () => {
  const source = readFileSync(packageTestRunnerPath, "utf8");

  assert.match(source, /gwd_engine\.\$\{platformTag\}\.node/);
  assert.match(source, /gwd_engine\.dev\.node/);
  assert.doesNotMatch(source, new RegExp(staleNativeEngine));
});
