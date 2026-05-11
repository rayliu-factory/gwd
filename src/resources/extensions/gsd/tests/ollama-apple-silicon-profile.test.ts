import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  OLLAMA_QWEN36_27B_NVFP4,
  OLLAMA_QWEN36_35B_A3B_NVFP4,
  OLLAMA_QWEN36_27B_MODEL,
  OLLAMA_QWEN36_35B_MODEL,
  adjustOllamaAppleSiliconFallbacks,
  clearOllamaAppleSiliconRuntimeSuppressions,
  isOllamaAppleSiliconResourceFailure,
  resolveOllamaAppleSiliconPreset,
  suppressOllamaAppleSiliconModelForRun,
} from "../ollama-apple-silicon-profile.ts";

const models = [
  { provider: "ollama", id: OLLAMA_QWEN36_27B_NVFP4 },
  { provider: "ollama", id: OLLAMA_QWEN36_35B_A3B_NVFP4 },
];

function preferenceOptOutPreset(basePath: string) {
  return resolveOllamaAppleSiliconPreset({
    isAutoMode: true,
    prefs: undefined,
    basePath,
    availableModels: models,
    autoModeStartModel: { provider: "ollama", id: OLLAMA_QWEN36_27B_NVFP4 },
    currentProvider: "ollama",
  });
}

test("resolveOllamaAppleSiliconPreset builds 27B/35B tier map when both tags are present", () => {
  clearOllamaAppleSiliconRuntimeSuppressions();
  const preset = resolveOllamaAppleSiliconPreset({
    isAutoMode: true,
    prefs: undefined,
    availableModels: models,
    autoModeStartModel: { provider: "ollama", id: OLLAMA_QWEN36_27B_NVFP4 },
    currentProvider: "ollama",
  });

  assert.ok(preset);
  assert.deepEqual(preset.modelConfig, {
    primary: OLLAMA_QWEN36_35B_MODEL,
    fallbacks: [OLLAMA_QWEN36_27B_MODEL],
    source: "synthesized",
  });
  assert.deepEqual(preset.routingConfig.tier_models, {
    light: OLLAMA_QWEN36_27B_MODEL,
    standard: OLLAMA_QWEN36_27B_MODEL,
    heavy: OLLAMA_QWEN36_35B_MODEL,
  });
  assert.equal(preset.routingConfig.cross_provider, false);
  assert.equal(preset.routingConfig.capability_routing, false);
});

test("resolveOllamaAppleSiliconPreset uses 27B for all tiers when 35B is missing", () => {
  clearOllamaAppleSiliconRuntimeSuppressions();
  const preset = resolveOllamaAppleSiliconPreset({
    isAutoMode: true,
    prefs: undefined,
    availableModels: [{ provider: "ollama", id: OLLAMA_QWEN36_27B_NVFP4 }],
    autoModeStartModel: { provider: "ollama", id: OLLAMA_QWEN36_27B_NVFP4 },
    currentProvider: "ollama",
  });

  assert.ok(preset);
  assert.equal(preset.missingHeavyModel, true);
  assert.deepEqual(preset.modelConfig, {
    primary: OLLAMA_QWEN36_27B_MODEL,
    fallbacks: [],
    source: "synthesized",
  });
  assert.deepEqual(preset.routingConfig.tier_models, {
    light: OLLAMA_QWEN36_27B_MODEL,
    standard: OLLAMA_QWEN36_27B_MODEL,
    heavy: OLLAMA_QWEN36_27B_MODEL,
  });
});

test("resolveOllamaAppleSiliconPreset does not activate without 27B", () => {
  clearOllamaAppleSiliconRuntimeSuppressions();
  const preset = resolveOllamaAppleSiliconPreset({
    isAutoMode: true,
    prefs: undefined,
    availableModels: [{ provider: "ollama", id: OLLAMA_QWEN36_35B_A3B_NVFP4 }],
    autoModeStartModel: { provider: "ollama", id: OLLAMA_QWEN36_35B_A3B_NVFP4 },
    currentProvider: "ollama",
  });

  assert.equal(preset, undefined);
});

test("resolveOllamaAppleSiliconPreset respects explicit models and dynamic_routing preferences", () => {
  clearOllamaAppleSiliconRuntimeSuppressions();
  assert.equal(resolveOllamaAppleSiliconPreset({
    isAutoMode: true,
    prefs: { models: { execution: OLLAMA_QWEN36_27B_MODEL } } as any,
    availableModels: models,
    autoModeStartModel: { provider: "ollama", id: OLLAMA_QWEN36_27B_NVFP4 },
    currentProvider: "ollama",
  }), undefined);

  assert.equal(resolveOllamaAppleSiliconPreset({
    isAutoMode: true,
    prefs: { dynamic_routing: { enabled: true } } as any,
    availableModels: models,
    autoModeStartModel: { provider: "ollama", id: OLLAMA_QWEN36_27B_NVFP4 },
    currentProvider: "ollama",
  }), undefined);
});

test("resolveOllamaAppleSiliconPreset respects explicit runtime prefs when basePath is present", () => {
  clearOllamaAppleSiliconRuntimeSuppressions();
  const tempRoot = mkdtempSync(join(tmpdir(), "ollama-profile-runtime-prefs-"));

  try {
    mkdirSync(join(tempRoot, ".gsd"), { recursive: true });

    assert.equal(resolveOllamaAppleSiliconPreset({
      isAutoMode: true,
      prefs: { dynamic_routing: { enabled: false } } as any,
      basePath: tempRoot,
      availableModels: models,
      autoModeStartModel: { provider: "ollama", id: OLLAMA_QWEN36_27B_NVFP4 },
      currentProvider: "ollama",
    }), undefined);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("resolveOllamaAppleSiliconPreset reads basePath preference files for opt outs", () => {
  const previousGwdHome = process.env.GWD_HOME;
  const previousCwd = process.cwd();
  const tempRoot = mkdtempSync(join(tmpdir(), "ollama-profile-prefs-"));

  try {
    const globalHome = join(tempRoot, "home");
    const projectRoot = join(tempRoot, "project");
    mkdirSync(globalHome, { recursive: true });
    mkdirSync(join(projectRoot, ".gsd"), { recursive: true });
    process.env.GWD_HOME = globalHome;
    process.chdir(projectRoot);

    const globalPrefsPath = join(globalHome, "PREFERENCES.md");
    const projectPrefsPath = join(projectRoot, ".gsd", "PREFERENCES.md");

    writeFileSync(globalPrefsPath, "---\nmodels:\n  execution: ollama/custom\n---\n", "utf-8");
    assert.equal(preferenceOptOutPreset(projectRoot), undefined, "global models");
    rmSync(globalPrefsPath, { force: true });

    writeFileSync(globalPrefsPath, "---\ndynamic_routing:\n  enabled: true\n---\n", "utf-8");
    assert.equal(preferenceOptOutPreset(projectRoot), undefined, "global dynamic_routing");
    rmSync(globalPrefsPath, { force: true });

    writeFileSync(projectPrefsPath, "---\nmodels:\n  execution: ollama/custom\n---\n", "utf-8");
    assert.equal(preferenceOptOutPreset(projectRoot), undefined, "project models");
    rmSync(projectPrefsPath, { force: true });

    writeFileSync(projectPrefsPath, "---\ndynamic_routing:\n  enabled: true\n---\n", "utf-8");
    assert.equal(preferenceOptOutPreset(projectRoot), undefined, "project dynamic_routing");
  } finally {
    process.chdir(previousCwd);
    if (previousGwdHome === undefined) {
      delete process.env.GWD_HOME;
    } else {
      process.env.GWD_HOME = previousGwdHome;
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("resolveOllamaAppleSiliconPreset only activates for Ollama in auto-mode", () => {
  clearOllamaAppleSiliconRuntimeSuppressions();
  assert.equal(resolveOllamaAppleSiliconPreset({
    isAutoMode: false,
    prefs: undefined,
    availableModels: models,
    autoModeStartModel: { provider: "ollama", id: OLLAMA_QWEN36_27B_NVFP4 },
    currentProvider: "ollama",
  }), undefined);

  assert.equal(resolveOllamaAppleSiliconPreset({
    isAutoMode: true,
    prefs: undefined,
    availableModels: models,
    autoModeStartModel: { provider: "anthropic", id: "claude-sonnet-4-6" },
    currentProvider: "anthropic",
  }), undefined);
});

test("35B runtime suppression routes heavy tier to 27B for the current run", () => {
  clearOllamaAppleSiliconRuntimeSuppressions();
  suppressOllamaAppleSiliconModelForRun("ollama", OLLAMA_QWEN36_35B_A3B_NVFP4);

  const preset = resolveOllamaAppleSiliconPreset({
    isAutoMode: true,
    prefs: undefined,
    availableModels: models,
    autoModeStartModel: { provider: "ollama", id: OLLAMA_QWEN36_27B_NVFP4 },
    currentProvider: "ollama",
  });

  assert.ok(preset);
  assert.equal(preset.heavySuppressed, true);
  assert.equal(preset.routingConfig.tier_models?.heavy, OLLAMA_QWEN36_27B_MODEL);
});

test("adjustOllamaAppleSiliconFallbacks keeps 35B heavy fallback to 27B only", () => {
  const heavy = adjustOllamaAppleSiliconFallbacks({
    modelId: OLLAMA_QWEN36_35B_MODEL,
    fallbacks: [],
    tier: "heavy",
    wasDowngraded: false,
    reason: "test",
    selectionMethod: "tier-only",
  });
  assert.deepEqual(heavy.fallbacks, [OLLAMA_QWEN36_27B_MODEL]);

  const standard = adjustOllamaAppleSiliconFallbacks({
    modelId: OLLAMA_QWEN36_27B_MODEL,
    fallbacks: [OLLAMA_QWEN36_35B_MODEL],
    tier: "standard",
    wasDowngraded: true,
    reason: "test",
    selectionMethod: "tier-only",
  });
  assert.deepEqual(standard.fallbacks, []);
});

test("isOllamaAppleSiliconResourceFailure matches local 35B resource failures only", () => {
  assert.equal(isOllamaAppleSiliconResourceFailure(
    "ollama",
    OLLAMA_QWEN36_35B_A3B_NVFP4,
    "llama runner process has terminated: out of memory",
  ), true);

  for (const message of [
    "allocation",
    "allocation failed",
    "model load",
    "model load error",
    "runner termination",
  ]) {
    assert.equal(isOllamaAppleSiliconResourceFailure(
      "ollama",
      OLLAMA_QWEN36_35B_A3B_NVFP4,
      message,
    ), true, message);
  }

  assert.equal(isOllamaAppleSiliconResourceFailure(
    "ollama",
    OLLAMA_QWEN36_27B_NVFP4,
    "llama runner process has terminated: out of memory",
  ), false);

  assert.equal(isOllamaAppleSiliconResourceFailure(
    "anthropic",
    OLLAMA_QWEN36_35B_A3B_NVFP4,
    "out of memory",
  ), false);
});
