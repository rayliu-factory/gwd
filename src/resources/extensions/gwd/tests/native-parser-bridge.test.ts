import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bridgePath = fileURLToPath(new URL("../native-parser-bridge.ts", import.meta.url));

test("native parser bridge uses GWD batch parser export names", () => {
  const source = readFileSync(bridgePath, "utf8");

  assert.match(source, /batchParseGwdFiles/);
  assert.match(source, /nativeBatchParseGwdFiles/);
  assert.match(source, /GwdTreeEntry/);
  assert.doesNotMatch(source, /batchParseGsdFiles/);
  assert.doesNotMatch(source, /nativeBatchParseGsdFiles/);
  assert.doesNotMatch(source, /GsdTreeEntry/);
});
