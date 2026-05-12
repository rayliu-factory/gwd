import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RoutingDecision } from "../model-router.ts";

import {
  VLLM_METAL_QWEN36_27B_FP8,
  VLLM_METAL_QWEN36_35B_A3B_FP8,
  VLLM_METAL_CONTEXT_TARGET,
  adjustVllmMetalQwen36Fallbacks,
  applyVllmMetalQwen36ContextTarget,
  clearVllmMetalQwen36RuntimeSuppressions,
  isLocalVllmMetalBaseUrl,
  isVllmMetalQwen36ResourceFailure,
  matchesVllmMetalQwen36_27B,
  matchesVllmMetalQwen36_35BA3B,
  resolveVllmMetalQwen36Preset,
  suppressVllmMetalQwen36ModelForRun,
} from "../vllm-metal-qwen36-profile.ts";

const qwen27 = {
  provider: "vllm-metal-27b",
  id: VLLM_METAL_QWEN36_27B_FP8,
  api: "openai-completions",
  baseUrl: "http://127.0.0.1:8000/v1",
  contextWindow: 128000,
};

const qwen35 = {
  provider: "vllm-metal-35b",
  id: VLLM_METAL_QWEN36_35B_A3B_FP8,
  api: "openai-completions",
  baseUrl: "http://127.0.0.1:8001/v1",
  contextWindow: 128000,
};

test("matches only Qwen3.6 27B and 35B-A3B model IDs", () => {
  assert.equal(matchesVllmMetalQwen36_27B("Qwen/Qwen3.6-27B-FP8"), true);
  assert.equal(matchesVllmMetalQwen36_27B("Qwen/Qwen3.6-27B-AWQ"), true);
  assert.equal(matchesVllmMetalQwen36_27B("Qwen/Qwen3.6-35B-A3B-FP8"), false);
  assert.equal(matchesVllmMetalQwen36_27B("qwen3.6:27b-coding-nvfp4"), false);

  assert.equal(matchesVllmMetalQwen36_35BA3B("Qwen/Qwen3.6-35B-A3B-FP8"), true);
  assert.equal(matchesVllmMetalQwen36_35BA3B("Qwen/Qwen3.6-35B-A3B-AWQ"), true);
  assert.equal(matchesVllmMetalQwen36_35BA3B("Qwen/Qwen3.6-27B-FP8"), false);
  assert.equal(matchesVllmMetalQwen36_35BA3B("Qwen/Qwen3.5-35B-A3B"), false);
});

test("recognizes local vLLM-style base URLs only", () => {
  assert.equal(isLocalVllmMetalBaseUrl("http://127.0.0.1:8000/v1"), true);
  assert.equal(isLocalVllmMetalBaseUrl("http://localhost:8001/v1"), true);
  assert.equal(isLocalVllmMetalBaseUrl("http://[::1]:8000/v1"), true);
  assert.equal(isLocalVllmMetalBaseUrl("https://api.example.com/v1"), false);
  assert.equal(isLocalVllmMetalBaseUrl(undefined), false);
});

test("resolveVllmMetalQwen36Preset uses 27B for every tier when 35B endpoint is absent", () => {
  clearVllmMetalQwen36RuntimeSuppressions();
  const preset = resolveVllmMetalQwen36Preset({
    isAutoMode: true,
    prefs: undefined,
    availableModels: [qwen27],
    autoModeStartModel: { provider: "vllm-metal-27b", id: VLLM_METAL_QWEN36_27B_FP8 },
    currentProvider: "vllm-metal-27b",
  });

  assert.ok(preset);
  assert.equal(preset.missingHeavyModel, true);
  assert.deepEqual(preset.routingConfig.tier_models, {
    light: "vllm-metal-27b/Qwen/Qwen3.6-27B-FP8",
    standard: "vllm-metal-27b/Qwen/Qwen3.6-27B-FP8",
    heavy: "vllm-metal-27b/Qwen/Qwen3.6-27B-FP8",
  });
});

test("resolveVllmMetalQwen36Preset routes heavy to separate local 35B endpoint when present", () => {
  clearVllmMetalQwen36RuntimeSuppressions();
  const preset = resolveVllmMetalQwen36Preset({
    isAutoMode: true,
    prefs: undefined,
    availableModels: [qwen27, qwen35],
    autoModeStartModel: { provider: "vllm-metal-27b", id: VLLM_METAL_QWEN36_27B_FP8 },
    currentProvider: "vllm-metal-27b",
  });

  assert.ok(preset);
  assert.equal(preset.missingHeavyModel, false);
  assert.deepEqual(preset.modelConfig, {
    primary: "vllm-metal-35b/Qwen/Qwen3.6-35B-A3B-FP8",
    fallbacks: ["vllm-metal-27b/Qwen/Qwen3.6-27B-FP8"],
    source: "synthesized",
  });
  assert.equal(preset.routingConfig.tier_models?.heavy, "vllm-metal-35b/Qwen/Qwen3.6-35B-A3B-FP8");
});

test("resolveVllmMetalQwen36Preset ignores remote endpoints and explicit routing preferences", () => {
  const remote27 = { ...qwen27, provider: "remote", baseUrl: "https://api.example.com/v1" };
  assert.equal(resolveVllmMetalQwen36Preset({
    isAutoMode: true,
    prefs: undefined,
    availableModels: [remote27],
    autoModeStartModel: { provider: "remote", id: VLLM_METAL_QWEN36_27B_FP8 },
    currentProvider: "remote",
  }), undefined);

  assert.equal(resolveVllmMetalQwen36Preset({
    isAutoMode: true,
    prefs: { dynamic_routing: { enabled: true } } as any,
    availableModels: [qwen27, qwen35],
    autoModeStartModel: { provider: "vllm-metal-27b", id: VLLM_METAL_QWEN36_27B_FP8 },
    currentProvider: "vllm-metal-27b",
  }), undefined);
});

test("context target applies 196608 unless context_window_override wins", () => {
  assert.equal(applyVllmMetalQwen36ContextTarget(qwen27, undefined).contextWindow, VLLM_METAL_CONTEXT_TARGET);
  assert.equal(
    applyVllmMetalQwen36ContextTarget(qwen27, { context_window_override: 131072 } as any).contextWindow,
    131072,
  );
  assert.equal(
    applyVllmMetalQwen36ContextTarget({ ...qwen27, id: "Qwen/Qwen3.5-27B" }, undefined).contextWindow,
    128000,
  );
});

test("35B suppression routes heavy to 27B until cleared", () => {
  clearVllmMetalQwen36RuntimeSuppressions();
  suppressVllmMetalQwen36ModelForRun("vllm-metal-35b", VLLM_METAL_QWEN36_35B_A3B_FP8);

  const suppressed = resolveVllmMetalQwen36Preset({
    isAutoMode: true,
    prefs: undefined,
    availableModels: [qwen27, qwen35],
    autoModeStartModel: { provider: "vllm-metal-27b", id: VLLM_METAL_QWEN36_27B_FP8 },
    currentProvider: "vllm-metal-27b",
  });
  assert.ok(suppressed);
  assert.equal(suppressed.heavySuppressed, true);
  assert.equal(suppressed.routingConfig.tier_models?.heavy, "vllm-metal-27b/Qwen/Qwen3.6-27B-FP8");

  clearVllmMetalQwen36RuntimeSuppressions();
  const restored = resolveVllmMetalQwen36Preset({
    isAutoMode: true,
    prefs: undefined,
    availableModels: [qwen27, qwen35],
    autoModeStartModel: { provider: "vllm-metal-27b", id: VLLM_METAL_QWEN36_27B_FP8 },
    currentProvider: "vllm-metal-27b",
  });
  assert.ok(restored);
  assert.equal(restored.routingConfig.tier_models?.heavy, "vllm-metal-35b/Qwen/Qwen3.6-35B-A3B-FP8");
});

test("adjustVllmMetalQwen36Fallbacks lets heavy fall back only to 27B and blocks 27B upward fallback", () => {
  clearVllmMetalQwen36RuntimeSuppressions();
  const preset = resolveVllmMetalQwen36Preset({
    isAutoMode: true,
    prefs: undefined,
    availableModels: [qwen27, qwen35],
    autoModeStartModel: { provider: "vllm-metal-27b", id: VLLM_METAL_QWEN36_27B_FP8 },
    currentProvider: "vllm-metal-27b",
  });
  assert.ok(preset);

  const heavyDecision = {
    modelId: "vllm-metal-35b/Qwen/Qwen3.6-35B-A3B-FP8",
    fallbacks: [
      "vllm-metal-35b/Qwen/Qwen3.6-35B-A3B-FP8",
      "vllm-metal-27b/Qwen/Qwen3.6-27B-FP8",
      "some-upward-fallback",
    ],
    tier: "heavy",
    wasDowngraded: false,
    reason: "test",
    selectionMethod: "tier-only",
  } satisfies RoutingDecision;
  assert.deepEqual(adjustVllmMetalQwen36Fallbacks(heavyDecision, preset).fallbacks, [
    "vllm-metal-27b/Qwen/Qwen3.6-27B-FP8",
  ]);

  const standardDecision = {
    ...heavyDecision,
    tier: "standard",
    wasDowngraded: false,
    reason: "configured model is unknown",
  } satisfies RoutingDecision;
  assert.deepEqual(adjustVllmMetalQwen36Fallbacks(standardDecision, preset), {
    ...standardDecision,
    modelId: "vllm-metal-27b/Qwen/Qwen3.6-27B-FP8",
    fallbacks: [],
    wasDowngraded: true,
    reason: "vLLM Metal Qwen3.6 profile routes non-heavy work to 27B",
  });

  const defaultDecision = {
    ...heavyDecision,
    modelId: "vllm-metal-27b/Qwen/Qwen3.6-27B-FP8",
    fallbacks: ["vllm-metal-35b/Qwen/Qwen3.6-35B-A3B-FP8"],
  };
  assert.deepEqual(adjustVllmMetalQwen36Fallbacks(defaultDecision, preset).fallbacks, []);
});

test("resource failure classification is narrow to local 35B-A3B models", () => {
  assert.equal(isVllmMetalQwen36ResourceFailure(
    "vllm-metal-35b",
    VLLM_METAL_QWEN36_35B_A3B_FP8,
    "RuntimeError: out of memory while loading model",
  ), true);
  assert.equal(isVllmMetalQwen36ResourceFailure(
    qwen35,
    "RuntimeError: out of memory while loading model",
  ), true);
  assert.equal(isVllmMetalQwen36ResourceFailure(
    {
      provider: "openai-compatible",
      id: VLLM_METAL_QWEN36_35B_A3B_FP8,
      api: "openai-completions",
      baseUrl: "https://api.example.com/v1",
    },
    "RuntimeError: out of memory while loading model",
  ), false);
  assert.equal(isVllmMetalQwen36ResourceFailure(
    "openai-compatible",
    VLLM_METAL_QWEN36_35B_A3B_FP8,
    "RuntimeError: out of memory while loading model",
  ), false);
  assert.equal(isVllmMetalQwen36ResourceFailure(
    "vllm-metal-35b",
    VLLM_METAL_QWEN36_35B_A3B_FP8,
    "invalid request: tool schema is unsupported",
  ), false);
  assert.equal(isVllmMetalQwen36ResourceFailure(
    "vllm-metal-27b",
    VLLM_METAL_QWEN36_27B_FP8,
    "out of memory",
  ), false);
});

test("auto lifecycle clears vllm-metal runtime suppressions beside Ollama suppressions", () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(testDir, "../auto.ts"), "utf-8");

  assert.match(
    source,
    /clearOllamaAppleSiliconRuntimeSuppressions\(\);\s+clearVllmMetalQwen36RuntimeSuppressions\(\);/,
  );
  assert.equal(
    source.match(/clearVllmMetalQwen36RuntimeSuppressions\(\);/g)?.length,
    2,
  );
});
