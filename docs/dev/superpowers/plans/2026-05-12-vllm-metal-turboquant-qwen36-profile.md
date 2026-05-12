# vLLM Metal TurboQuant Qwen3.6 Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic GWD auto-mode support for a local `vllm-metal` TurboQuant Qwen3.6 profile on 48GB Apple Silicon.

**Architecture:** GWD will passively discover default local vLLM-compatible endpoints, synthesize a Qwen3.6 routing profile when 27B is available, and apply a 196608-token effective context target without managing the inference server. The profile module stays parallel to the existing Ollama Apple Silicon profile and reuses the same auto-model-selection, context-budget, and agent-end recovery paths.

**Tech Stack:** TypeScript, Node test runner, GWD extension runtime, OpenAI-compatible provider registration, existing GWD model router and provider recovery modules.

---

## File Structure

- Create `src/resources/extensions/gwd/vllm-metal-qwen36-profile.ts`: constants, model matchers, local endpoint checks, synthesized routing, 192K context helper, run-scoped heavy suppression, and resource-failure classification.
- Create `src/resources/extensions/gwd/tests/vllm-metal-qwen36-profile.test.ts`: pure tests for matching, activation, opt-out behavior, routing, context target precedence, and suppression.
- Create `src/resources/extensions/gwd/vllm-metal-autodetect.ts`: passive default-port `/v1/models` discovery and session-local provider registration.
- Create `src/resources/extensions/gwd/tests/vllm-metal-autodetect.test.ts`: tests for default-port discovery, closed-port silence, provider registration shape, and model filtering.
- Modify `src/resources/extensions/gwd/bootstrap/register-hooks.ts`: run passive vLLM Metal discovery during `session_start` and `session_switch`.
- Modify `src/resources/extensions/gwd/auto-model-selection.ts`: resolve the vLLM Metal profile alongside the Ollama profile, inject synthesized routing, apply context metadata, and adjust fallback lists.
- Modify `src/resources/extensions/gwd/bootstrap/agent-end-recovery.ts`: recover 35B-A3B resource/load failures by switching to 27B and suppressing 35B-A3B for the current auto run.
- Modify `src/resources/extensions/gwd/auto.ts`: clear vLLM Metal runtime suppression on auto start and stop.
- Modify `src/resources/extensions/gwd/tests/auto-model-selection.test.ts`: cover dispatch integration, 192K context application, explicit preference opt-out, and heavy endpoint routing.
- Modify `src/resources/extensions/gwd/tests/provider-errors.test.ts`: cover agent-end fallback and non-resource behavior.
- Modify `docs/user-docs/providers.md`: document startup commands, automatic default-port detection, optional 35B endpoint behavior, and `context_window_override`.
- Modify `docs/user-docs/custom-models.md`: document manual `models.json` setup for custom vLLM Metal ports and two-endpoint routing.
- Modify `gitbook/configuration/providers.md`: mirror the provider setup guide for published GitBook docs.
- Modify `gitbook/configuration/custom-models.md`: mirror the custom-port `models.json` guide for published GitBook docs.
- Modify `docs/zh-CN/user-docs/providers.md`: mirror the provider setup guidance in Simplified Chinese.
- Modify `docs/zh-CN/user-docs/custom-models.md`: mirror the custom-port guide in Simplified Chinese.
- Modify `README.md`: add a direct Provider Setup guide link so users can find the Apple Silicon local-model profile from the root README.

---

### Task 1: Pure vLLM Metal Qwen3.6 Profile

**Files:**
- Create: `src/resources/extensions/gwd/vllm-metal-qwen36-profile.ts`
- Test: `src/resources/extensions/gwd/tests/vllm-metal-qwen36-profile.test.ts`

- [ ] **Step 1: Write failing pure profile tests**

Create `src/resources/extensions/gwd/tests/vllm-metal-qwen36-profile.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  VLLM_METAL_QWEN36_27B_FP8,
  VLLM_METAL_QWEN36_35B_A3B_FP8,
  VLLM_METAL_CONTEXT_TARGET,
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

test("resource failure classification is narrow to local 35B-A3B models", () => {
  assert.equal(isVllmMetalQwen36ResourceFailure(
    "vllm-metal-35b",
    VLLM_METAL_QWEN36_35B_A3B_FP8,
    "RuntimeError: out of memory while loading model",
  ), true);
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
```

- [ ] **Step 2: Run the pure profile test and verify it fails**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/vllm-metal-qwen36-profile.test.ts
```

Expected: FAIL with a module-not-found error for `vllm-metal-qwen36-profile.ts`.

- [ ] **Step 3: Implement the pure profile module**

Create `src/resources/extensions/gwd/vllm-metal-qwen36-profile.ts`:

```ts
import type { DynamicRoutingConfig, RoutingDecision } from "./model-router.js";
import type { GWDPreferences } from "./preferences.js";
import { loadGlobalGWDPreferences, loadProjectGWDPreferences } from "./preferences.js";
import type { PreferredModelConfig } from "./auto-model-selection.js";

export const VLLM_METAL_CONTEXT_TARGET = 196_608;
export const VLLM_METAL_QWEN36_27B_FP8 = "Qwen/Qwen3.6-27B-FP8";
export const VLLM_METAL_QWEN36_35B_A3B_FP8 = "Qwen/Qwen3.6-35B-A3B-FP8";

type ModelLike = {
  provider: string;
  id: string;
  api?: string;
  baseUrl?: string;
  contextWindow?: number;
};

export interface VllmMetalQwen36Preset {
  modelConfig: PreferredModelConfig;
  routingConfig: DynamicRoutingConfig;
  missingHeavyModel: boolean;
  heavySuppressed: boolean;
  defaultModelId: string;
  heavyModelId: string | null;
}

export interface VllmMetalQwen36PresetInput {
  isAutoMode: boolean;
  prefs?: GWDPreferences;
  basePath?: string;
  availableModels: ModelLike[];
  autoModeStartModel: ModelLike | null;
  currentProvider?: string;
}

const suppressedForRun = new Set<string>();
const OPENAI_COMPAT_APIS = new Set(["openai", "openai-completions", "openai-responses", "openai-codex-responses"]);

function key(provider: string, id: string): string {
  return `${provider.toLowerCase()}/${id.toLowerCase()}`;
}

export function matchesVllmMetalQwen36_27B(id: string | undefined): boolean {
  return typeof id === "string" && /^Qwen\/Qwen3\.6-27B(?:$|-)/.test(id);
}

export function matchesVllmMetalQwen36_35BA3B(id: string | undefined): boolean {
  return typeof id === "string" && /^Qwen\/Qwen3\.6-35B-A3B(?:$|-)/.test(id);
}

export function isLocalVllmMetalBaseUrl(baseUrl: string | undefined): boolean {
  if (!baseUrl) return false;
  try {
    const parsed = new URL(baseUrl);
    return parsed.protocol === "http:" &&
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "::1");
  } catch {
    return false;
  }
}

function isOpenAiCompatible(model: ModelLike): boolean {
  return typeof model.api === "string" && OPENAI_COMPAT_APIS.has(model.api);
}

function isEligible27B(model: ModelLike): boolean {
  return matchesVllmMetalQwen36_27B(model.id) && isOpenAiCompatible(model) && isLocalVllmMetalBaseUrl(model.baseUrl);
}

function isEligible35B(model: ModelLike): boolean {
  return matchesVllmMetalQwen36_35BA3B(model.id) && isOpenAiCompatible(model) && isLocalVllmMetalBaseUrl(model.baseUrl);
}

function modelRef(model: ModelLike): string {
  return `${model.provider}/${model.id}`;
}

function hasRoutingOverride(prefs: GWDPreferences | undefined): boolean {
  return prefs?.models !== undefined || prefs?.dynamic_routing !== undefined;
}

function hasExplicitModelRouting(input: VllmMetalQwen36PresetInput): boolean {
  if (input.basePath !== undefined) {
    const globalPrefs = loadGlobalGWDPreferences()?.preferences;
    const projectPrefs = loadProjectGWDPreferences(input.basePath)?.preferences;
    if (hasRoutingOverride(globalPrefs) || hasRoutingOverride(projectPrefs)) return true;
    if (globalPrefs || projectPrefs) return false;
  }
  return hasRoutingOverride(input.prefs);
}

function isVllmMetalSession(input: VllmMetalQwen36PresetInput): boolean {
  const providers = new Set(
    input.availableModels
      .filter((model) => isEligible27B(model) || isEligible35B(model))
      .map((model) => model.provider),
  );
  return providers.has(input.currentProvider ?? "") || providers.has(input.autoModeStartModel?.provider ?? "");
}

function isSuppressed(model: ModelLike): boolean {
  return suppressedForRun.has(key(model.provider, model.id));
}

export function clearVllmMetalQwen36RuntimeSuppressions(): void {
  suppressedForRun.clear();
}

export function suppressVllmMetalQwen36ModelForRun(provider: string | undefined, id: string | undefined): void {
  if (!provider || !matchesVllmMetalQwen36_35BA3B(id)) return;
  suppressedForRun.add(key(provider, id));
}

export function applyVllmMetalQwen36ContextTarget<T extends ModelLike>(
  model: T,
  prefs: GWDPreferences | undefined,
): T {
  if (!isEligible27B(model) && !isEligible35B(model)) return model;
  const override = prefs?.context_window_override;
  const contextWindow = override !== undefined && Number.isFinite(override) && override > 0
    ? override
    : VLLM_METAL_CONTEXT_TARGET;
  return { ...model, contextWindow };
}

export function resolveVllmMetalQwen36Preset(input: VllmMetalQwen36PresetInput): VllmMetalQwen36Preset | undefined {
  if (!input.isAutoMode) return undefined;
  if (hasExplicitModelRouting(input)) return undefined;

  const defaultModel = input.availableModels.find(isEligible27B);
  if (!defaultModel) return undefined;
  if (!isVllmMetalSession(input)) return undefined;

  const heavyCandidate = input.availableModels.find(isEligible35B);
  const useHeavy = !!heavyCandidate && !isSuppressed(heavyCandidate);
  const defaultModelId = modelRef(defaultModel);
  const heavyModelId = useHeavy && heavyCandidate ? modelRef(heavyCandidate) : defaultModelId;

  return {
    modelConfig: {
      primary: heavyModelId,
      fallbacks: useHeavy ? [defaultModelId] : [],
      source: "synthesized",
    },
    routingConfig: {
      enabled: true,
      cross_provider: false,
      capability_routing: false,
      tier_models: {
        light: defaultModelId,
        standard: defaultModelId,
        heavy: heavyModelId,
      },
    },
    missingHeavyModel: !heavyCandidate,
    heavySuppressed: !!heavyCandidate && !useHeavy,
    defaultModelId,
    heavyModelId: heavyCandidate ? modelRef(heavyCandidate) : null,
  };
}

export function adjustVllmMetalQwen36Fallbacks<T extends RoutingDecision>(
  decision: T,
  preset: VllmMetalQwen36Preset | undefined,
): T {
  if (!preset) return decision;
  if (decision.modelId === preset.heavyModelId && preset.heavyModelId !== preset.defaultModelId) {
    return { ...decision, fallbacks: [preset.defaultModelId] };
  }
  if (decision.modelId === preset.defaultModelId) {
    return { ...decision, fallbacks: [] };
  }
  return decision;
}

const RESOURCE_RE =
  /\b(?:oom|out of memory)\b|failed to allocate|cannot allocate|\ballocation(?: failed)?\b|insufficient memory|\bmodel load(?: error| failed| failure)?\b|failed to load model|runner process.*(?:terminated|exited|failed)|worker.*(?:terminated|exited|failed)/i;

export function isVllmMetalQwen36ResourceFailure(
  provider: string | undefined,
  id: string | undefined,
  errorMessage: string,
): boolean {
  if (!provider || !matchesVllmMetalQwen36_35BA3B(id)) return false;
  return RESOURCE_RE.test(errorMessage);
}
```

- [ ] **Step 4: Run the pure profile test and verify it passes**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/vllm-metal-qwen36-profile.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the pure profile module**

Run:

```bash
git add src/resources/extensions/gwd/vllm-metal-qwen36-profile.ts src/resources/extensions/gwd/tests/vllm-metal-qwen36-profile.test.ts
git commit -m "feat: add vllm-metal qwen profile resolver"
```

---

### Task 2: Passive vLLM Metal Default-Port Discovery

**Files:**
- Create: `src/resources/extensions/gwd/vllm-metal-autodetect.ts`
- Create: `src/resources/extensions/gwd/tests/vllm-metal-autodetect.test.ts`
- Modify: `src/resources/extensions/gwd/bootstrap/register-hooks.ts`

- [ ] **Step 1: Write failing autodetect tests**

Create `src/resources/extensions/gwd/tests/vllm-metal-autodetect.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_VLLM_METAL_BASE_URLS,
  discoverAndRegisterVllmMetalQwen36Providers,
} from "../vllm-metal-autodetect.ts";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Not Found",
    json: async () => body,
  } as Response;
}

test("discoverAndRegisterVllmMetalQwen36Providers registers default-port 27B provider", async () => {
  const registered: Array<{ name: string; config: any }> = [];
  const fetchCalls: string[] = [];

  await discoverAndRegisterVllmMetalQwen36Providers({
    fetchImpl: async (url) => {
      fetchCalls.push(String(url));
      if (String(url).startsWith("http://127.0.0.1:8000")) {
        return jsonResponse({ data: [{ id: "Qwen/Qwen3.6-27B-FP8" }] });
      }
      throw new Error("closed");
    },
    registerProvider: (name, config) => registered.push({ name, config }),
    timeoutMs: 5,
  });

  assert.deepEqual(fetchCalls[0], "http://127.0.0.1:8000/v1/models");
  assert.equal(registered.length, 1);
  assert.equal(registered[0].name, "vllm-metal-27b");
  assert.equal(registered[0].config.baseUrl, "http://127.0.0.1:8000/v1");
  assert.equal(registered[0].config.api, "openai-completions");
  assert.equal(registered[0].config.apiKey, "vllm");
  assert.equal(registered[0].config.models[0].id, "Qwen/Qwen3.6-27B-FP8");
  assert.equal(registered[0].config.models[0].contextWindow, 196608);
});

test("discoverAndRegisterVllmMetalQwen36Providers registers separate 27B and 35B providers", async () => {
  const registered: Array<{ name: string; config: any }> = [];

  await discoverAndRegisterVllmMetalQwen36Providers({
    baseUrls: ["http://127.0.0.1:8000/v1", "http://127.0.0.1:8001/v1"],
    fetchImpl: async (url) => {
      if (String(url).startsWith("http://127.0.0.1:8000")) {
        return jsonResponse({ data: [{ id: "Qwen/Qwen3.6-27B-FP8" }] });
      }
      return jsonResponse({ data: [{ id: "Qwen/Qwen3.6-35B-A3B-FP8" }] });
    },
    registerProvider: (name, config) => registered.push({ name, config }),
    timeoutMs: 5,
  });

  assert.deepEqual(registered.map((entry) => entry.name), ["vllm-metal-27b", "vllm-metal-35b"]);
});

test("discoverAndRegisterVllmMetalQwen36Providers ignores closed ports and unrelated models", async () => {
  const registered: Array<{ name: string; config: any }> = [];

  await discoverAndRegisterVllmMetalQwen36Providers({
    baseUrls: ["http://127.0.0.1:8000/v1", "http://127.0.0.1:8001/v1"],
    fetchImpl: async (url) => {
      if (String(url).startsWith("http://127.0.0.1:8000")) throw new Error("ECONNREFUSED");
      return jsonResponse({ data: [{ id: "Qwen/Qwen3.5-27B" }] });
    },
    registerProvider: (name, config) => registered.push({ name, config }),
    timeoutMs: 5,
  });

  assert.equal(registered.length, 0);
});

test("default URL list includes 8000 and 8001 localhost variants", () => {
  assert.deepEqual(DEFAULT_VLLM_METAL_BASE_URLS, [
    "http://127.0.0.1:8000/v1",
    "http://localhost:8000/v1",
    "http://127.0.0.1:8001/v1",
    "http://localhost:8001/v1",
  ]);
});
```

- [ ] **Step 2: Run autodetect tests and verify they fail**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/vllm-metal-autodetect.test.ts
```

Expected: FAIL with a module-not-found error for `vllm-metal-autodetect.ts`.

- [ ] **Step 3: Implement passive discovery and session-local registration**

Create `src/resources/extensions/gwd/vllm-metal-autodetect.ts`:

```ts
import type { ProviderConfig } from "@gwd/pi-coding-agent";
import {
  VLLM_METAL_CONTEXT_TARGET,
  matchesVllmMetalQwen36_27B,
  matchesVllmMetalQwen36_35BA3B,
} from "./vllm-metal-qwen36-profile.js";

export const DEFAULT_VLLM_METAL_BASE_URLS = [
  "http://127.0.0.1:8000/v1",
  "http://localhost:8000/v1",
  "http://127.0.0.1:8001/v1",
  "http://localhost:8001/v1",
];

type FetchLike = typeof fetch;

interface DiscoverInput {
  baseUrls?: string[];
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  registerProvider: (name: string, config: ProviderConfig) => void;
}

function providerNameForModel(id: string): string | undefined {
  if (matchesVllmMetalQwen36_27B(id)) return "vllm-metal-27b";
  if (matchesVllmMetalQwen36_35BA3B(id)) return "vllm-metal-35b";
  return undefined;
}

async function fetchModels(baseUrl: string, fetchImpl: FetchLike, timeoutMs: number): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/models`, {
      headers: { Authorization: "Bearer vllm" },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const body = await response.json() as { data?: Array<{ id?: unknown }> };
    return (body.data ?? [])
      .map((model) => model.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function discoverAndRegisterVllmMetalQwen36Providers(input: DiscoverInput): Promise<void> {
  const baseUrls = input.baseUrls ?? DEFAULT_VLLM_METAL_BASE_URLS;
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 350;
  const registeredNames = new Set<string>();

  for (const baseUrl of baseUrls) {
    const modelIds = await fetchModels(baseUrl, fetchImpl, timeoutMs);
    for (const id of modelIds) {
      const providerName = providerNameForModel(id);
      if (!providerName || registeredNames.has(providerName)) continue;
      registeredNames.add(providerName);
      input.registerProvider(providerName, {
        authMode: "apiKey",
        apiKey: "vllm",
        baseUrl,
        api: "openai-completions",
        models: [{
          id,
          name: id,
          reasoning: true,
          input: ["text"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: VLLM_METAL_CONTEXT_TARGET,
          maxTokens: 16384,
          compat: {
            supportsDeveloperRole: false,
            supportsReasoningEffort: false,
            supportsUsageInStreaming: false,
            thinkingFormat: "qwen-chat-template" as any,
          },
        }],
      });
    }
  }
}
```

- [ ] **Step 4: Hook passive discovery into session startup and switch**

In `src/resources/extensions/gwd/bootstrap/register-hooks.ts`, add this helper near the existing `applyCompactionThresholdOverride` helper functions:

```ts
async function applyVllmMetalQwen36Autodiscovery(ctx: ExtensionContext): Promise<void> {
  try {
    const { discoverAndRegisterVllmMetalQwen36Providers } = await import("../vllm-metal-autodetect.js");
    await discoverAndRegisterVllmMetalQwen36Providers({
      registerProvider: (name, config) => ctx.modelRegistry.registerProvider(name, config),
    });
  } catch (err) {
    safetyLogWarning(
      "providers",
      `vllm-metal autodiscovery skipped: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
```

Then call it in both `session_start` and `session_switch` after `await applyDisabledModelProviderPolicy(ctx);`:

```ts
await applyVllmMetalQwen36Autodiscovery(ctx);
```

- [ ] **Step 5: Run autodetect tests and verify they pass**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/vllm-metal-autodetect.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit passive discovery**

Run:

```bash
git add src/resources/extensions/gwd/vllm-metal-autodetect.ts src/resources/extensions/gwd/tests/vllm-metal-autodetect.test.ts src/resources/extensions/gwd/bootstrap/register-hooks.ts
git commit -m "feat: autodetect local vllm-metal qwen servers"
```

---

### Task 3: Auto-Mode Model Selection Integration

**Files:**
- Modify: `src/resources/extensions/gwd/auto-model-selection.ts`
- Test: `src/resources/extensions/gwd/tests/auto-model-selection.test.ts`

- [ ] **Step 1: Add failing selection tests**

Append tests near the existing Ollama Apple Silicon tests in `src/resources/extensions/gwd/tests/auto-model-selection.test.ts`:

```ts
test("selectAndApplyModel applies vllm-metal 192K context to Qwen3.6 27B default", async () => {
  const setModelCalls: any[] = [];
  const availableModels = [
    {
      id: "Qwen/Qwen3.6-27B-FP8",
      provider: "vllm-metal-27b",
      api: "openai-completions",
      baseUrl: "http://127.0.0.1:8000/v1",
      contextWindow: 128000,
    },
  ];

  const result = await selectAndApplyModel(
    {
      modelRegistry: { getAvailable: () => availableModels },
      sessionManager: { getSessionId: () => "vllm-metal-test" },
      ui: { notify: () => {} },
      model: availableModels[0],
    } as any,
    {
      setModel: async (model: any) => { setModelCalls.push(model); return true; },
      emitBeforeModelSelect: async () => undefined,
      getActiveTools: () => [],
      emitAdjustToolSet: async () => undefined,
      setActiveTools: () => {},
      getThinkingLevel: () => null,
      setThinkingLevel: () => {},
    } as any,
    "execute-task",
    "M001/S01/T01",
    makeTempDir("gwd-vllm-profile-"),
    undefined,
    false,
    { provider: "vllm-metal-27b", id: "Qwen/Qwen3.6-27B-FP8" },
    undefined,
    true,
  );

  assert.equal(setModelCalls[0]?.contextWindow, 196608);
  assert.equal(result.appliedModel?.provider, "vllm-metal-27b");
  assert.equal(result.appliedModel?.contextWindow, 196608);
});

test("selectAndApplyModel routes heavy vllm-metal work to separate 35B endpoint with 27B fallback", async () => {
  const setModelCalls: any[] = [];
  const availableModels = [
    {
      id: "Qwen/Qwen3.6-27B-FP8",
      provider: "vllm-metal-27b",
      api: "openai-completions",
      baseUrl: "http://127.0.0.1:8000/v1",
      contextWindow: 128000,
    },
    {
      id: "Qwen/Qwen3.6-35B-A3B-FP8",
      provider: "vllm-metal-35b",
      api: "openai-completions",
      baseUrl: "http://127.0.0.1:8001/v1",
      contextWindow: 128000,
    },
  ];

  await selectAndApplyModel(
    {
      modelRegistry: { getAvailable: () => availableModels },
      sessionManager: { getSessionId: () => "vllm-metal-heavy-test" },
      ui: { notify: () => {} },
      model: availableModels[0],
    } as any,
    {
      setModel: async (model: any) => { setModelCalls.push(model); return true; },
      emitBeforeModelSelect: async () => undefined,
      getActiveTools: () => [],
      emitAdjustToolSet: async () => undefined,
      setActiveTools: () => {},
      getThinkingLevel: () => null,
      setThinkingLevel: () => {},
    } as any,
    "plan-slice",
    "slice-1",
    makeTempDir("gwd-vllm-heavy-profile-"),
    undefined,
    false,
    { provider: "vllm-metal-27b", id: "Qwen/Qwen3.6-27B-FP8" },
    undefined,
    true,
  );

  assert.equal(setModelCalls[0]?.provider, "vllm-metal-35b");
  assert.equal(setModelCalls[0]?.id, "Qwen/Qwen3.6-35B-A3B-FP8");
  assert.equal(setModelCalls[0]?.contextWindow, 196608);
});

test("selectAndApplyModel lets context_window_override win for vllm-metal Qwen3.6", async () => {
  const setModelCalls: any[] = [];
  const availableModels = [{
    id: "Qwen/Qwen3.6-27B-FP8",
    provider: "vllm-metal-27b",
    api: "openai-completions",
    baseUrl: "http://127.0.0.1:8000/v1",
    contextWindow: 128000,
  }];

  await selectAndApplyModel(
    {
      modelRegistry: { getAvailable: () => availableModels },
      sessionManager: { getSessionId: () => "vllm-metal-override-test" },
      ui: { notify: () => {} },
      model: availableModels[0],
    } as any,
    {
      setModel: async (model: any) => { setModelCalls.push(model); return true; },
      emitBeforeModelSelect: async () => undefined,
      getActiveTools: () => [],
      emitAdjustToolSet: async () => undefined,
      setActiveTools: () => {},
      getThinkingLevel: () => null,
      setThinkingLevel: () => {},
    } as any,
    "execute-task",
    "M001/S01/T01",
    makeTempDir("gwd-vllm-override-profile-"),
    { context_window_override: 131072 } as any,
    false,
    { provider: "vllm-metal-27b", id: "Qwen/Qwen3.6-27B-FP8" },
    undefined,
    true,
  );

  assert.equal(setModelCalls[0]?.contextWindow, 131072);
});
```

- [ ] **Step 2: Run selection tests and verify they fail**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/auto-model-selection.test.ts
```

Expected: FAIL. The new tests should apply raw `contextWindow: 128000` or skip synthesized routing.

- [ ] **Step 3: Import and resolve the vLLM Metal profile in model selection**

In `src/resources/extensions/gwd/auto-model-selection.ts`, extend the imports near the Ollama profile import:

```ts
import {
  adjustVllmMetalQwen36Fallbacks,
  applyVllmMetalQwen36ContextTarget,
  resolveVllmMetalQwen36Preset,
} from "./vllm-metal-qwen36-profile.js";
```

After `ollamaAppleSiliconPreset` is resolved, add:

```ts
  const vllmMetalQwen36Preset = effectiveSessionModelOverride
    ? undefined
    : resolveVllmMetalQwen36Preset({
        isAutoMode,
        prefs,
        basePath,
        availableModels,
        autoModeStartModel,
        currentProvider: ctx.model?.provider,
      });
  if (vllmMetalQwen36Preset?.missingHeavyModel && verbose) {
    ctx.ui.notify(
      "vLLM Metal Qwen3.6 profile: 35B-A3B endpoint is not available; heavy work will use Qwen3.6 27B.",
      "info",
    );
  } else if (vllmMetalQwen36Preset?.heavySuppressed) {
    ctx.ui.notify(
      "vLLM Metal Qwen3.6 profile: 35B-A3B is suppressed for this run after a local resource failure; heavy work will use Qwen3.6 27B.",
      "warning",
    );
  }
```

Change `modelConfig` resolution to prefer either synthesized local profile:

```ts
  const modelConfig = effectiveSessionModelOverride
    ? undefined
    : (
        ollamaAppleSiliconPreset?.modelConfig
        ?? vllmMetalQwen36Preset?.modelConfig
        ?? resolvePreferredModelConfig(unitType, autoModeStartModel, isAutoMode)
      );
```

When building `routingConfig`, merge the vLLM Metal routing after the Ollama routing:

```ts
    const routingConfig = {
      ...resolveDynamicRoutingConfig(),
      ...(ollamaAppleSiliconPreset?.routingConfig ?? {}),
      ...(vllmMetalQwen36Preset?.routingConfig ?? {}),
    };
```

Where Ollama fallback adjustment runs, add vLLM Metal fallback adjustment:

```ts
        if (ollamaAppleSiliconPreset) {
          routingResult = adjustOllamaAppleSiliconFallbacks(routingResult);
        }
        if (vllmMetalQwen36Preset) {
          routingResult = adjustVllmMetalQwen36Fallbacks(routingResult, vllmMetalQwen36Preset);
        }
```

Where `modelToApply` is currently assigned, wrap both context helpers:

```ts
      const modelToApply = applyVllmMetalQwen36ContextTarget(
        applyOllamaAppleSiliconContextOverride(model, prefs),
        prefs,
      );
```

Where `startModelToApply` and `fallbackModelToApply` are assigned, apply the same wrapper:

```ts
        const startModelToApply = applyVllmMetalQwen36ContextTarget(
          applyOllamaAppleSiliconContextOverride(startModel, prefs),
          prefs,
        );
```

```ts
            const fallbackModelToApply = applyVllmMetalQwen36ContextTarget(
              applyOllamaAppleSiliconContextOverride(byId, prefs),
              prefs,
            );
```

Update the burn-max condition so local memory-safety routing stays enabled for either profile:

```ts
    if (prefs?.token_profile === "burn-max" && !ollamaAppleSiliconPreset && !vllmMetalQwen36Preset) {
      routingConfig.enabled = false;
    }
```

- [ ] **Step 4: Run selection and pure profile tests**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/vllm-metal-qwen36-profile.test.ts src/resources/extensions/gwd/tests/auto-model-selection.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit auto-mode integration**

Run:

```bash
git add src/resources/extensions/gwd/auto-model-selection.ts src/resources/extensions/gwd/tests/auto-model-selection.test.ts
git commit -m "feat: route auto-mode through vllm-metal qwen profile"
```

---

### Task 4: Agent-End Recovery And Suppression Lifecycle

**Files:**
- Modify: `src/resources/extensions/gwd/bootstrap/agent-end-recovery.ts`
- Modify: `src/resources/extensions/gwd/auto.ts`
- Test: `src/resources/extensions/gwd/tests/provider-errors.test.ts`
- Test: `src/resources/extensions/gwd/tests/vllm-metal-qwen36-profile.test.ts`

- [ ] **Step 1: Add failing provider recovery tests**

In `src/resources/extensions/gwd/tests/provider-errors.test.ts`, add imports:

```ts
import {
  VLLM_METAL_QWEN36_27B_FP8,
  VLLM_METAL_QWEN36_35B_A3B_FP8,
  clearVllmMetalQwen36RuntimeSuppressions,
  resolveVllmMetalQwen36Preset,
} from "../vllm-metal-qwen36-profile.ts";
```

Add these tests near the Ollama Apple Silicon recovery tests:

```ts
const vllm27BModel = {
  provider: "vllm-metal-27b",
  id: VLLM_METAL_QWEN36_27B_FP8,
  api: "openai-completions",
  baseUrl: "http://127.0.0.1:8000/v1",
  contextWindow: 196608,
};
const vllm35BModel = {
  provider: "vllm-metal-35b",
  id: VLLM_METAL_QWEN36_35B_A3B_FP8,
  api: "openai-completions",
  baseUrl: "http://127.0.0.1:8001/v1",
  contextWindow: 196608,
};

function cleanupVllmMetalAgentEndTest(): void {
  clearVllmMetalQwen36RuntimeSuppressions();
  _resetPendingResolve();
  autoSession.reset();
}

function makeVllmMetal35BResourceFailureHarness(setModelResult: boolean, message = "model load failed: out of memory") {
  const notifications: Array<{ message: string; level: string }> = [];
  const setModelCalls: Array<{ model: unknown; options: unknown }> = [];
  const sendMessageCalls: Array<{ message: unknown; options: unknown }> = [];
  const ctx = {
    model: vllm35BModel,
    modelRegistry: { getAvailable: () => [vllm27BModel, vllm35BModel] },
    sessionManager: { getSessionFile: () => null },
    ui: {
      notify: (text: string, level = "info") => notifications.push({ message: text, level }),
      setStatus: () => {},
      setWidget: () => {},
    },
  };
  const pi = {
    setModel: async (model: unknown, options: unknown) => {
      setModelCalls.push({ model, options });
      return setModelResult;
    },
    sendMessage: (message: unknown, options: unknown) => sendMessageCalls.push({ message, options }),
  };
  const event = { messages: [{ stopReason: "error", errorMessage: message }] };
  return { ctx, pi, event, notifications, setModelCalls, sendMessageCalls };
}

test("agent-end recovery switches vllm-metal Qwen3.6 35B resource failures to 27B and suppresses 35B", async () => {
  cleanupVllmMetalAgentEndTest();
  try {
    _setAutoActiveForTest(true);
    const harness = makeVllmMetal35BResourceFailureHarness(true);

    await handleAgentEnd(harness.pi as any, harness.event as any, harness.ctx as any);

    assert.deepEqual(harness.setModelCalls, [{ model: vllm27BModel, options: { persist: false } }]);
    assert.equal(harness.sendMessageCalls.length, 1);
    const preset = resolveVllmMetalQwen36Preset({
      isAutoMode: true,
      prefs: undefined,
      availableModels: [vllm27BModel, vllm35BModel],
      autoModeStartModel: { provider: "vllm-metal-27b", id: VLLM_METAL_QWEN36_27B_FP8 },
      currentProvider: "vllm-metal-27b",
    });
    assert.ok(preset);
    assert.equal(preset.routingConfig.tier_models?.heavy, "vllm-metal-27b/Qwen/Qwen3.6-27B-FP8");
  } finally {
    cleanupVllmMetalAgentEndTest();
  }
});

test("agent-end recovery does not suppress vllm-metal Qwen3.6 35B for non-resource errors", async () => {
  cleanupVllmMetalAgentEndTest();
  try {
    _setAutoActiveForTest(true);
    const harness = makeVllmMetal35BResourceFailureHarness(true, "invalid request: unsupported tool schema");

    await handleAgentEnd(harness.pi as any, harness.event as any, harness.ctx as any);

    assert.equal(harness.setModelCalls.length, 0);
    const preset = resolveVllmMetalQwen36Preset({
      isAutoMode: true,
      prefs: undefined,
      availableModels: [vllm27BModel, vllm35BModel],
      autoModeStartModel: { provider: "vllm-metal-27b", id: VLLM_METAL_QWEN36_27B_FP8 },
      currentProvider: "vllm-metal-27b",
    });
    assert.ok(preset);
    assert.equal(preset.routingConfig.tier_models?.heavy, "vllm-metal-35b/Qwen/Qwen3.6-35B-A3B-FP8");
  } finally {
    cleanupVllmMetalAgentEndTest();
  }
});
```

- [ ] **Step 2: Run provider error tests and verify they fail**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/provider-errors.test.ts
```

Expected: FAIL. The new vLLM Metal recovery path should not switch to 27B yet.

- [ ] **Step 3: Implement vLLM Metal resource fallback in agent-end recovery**

In `src/resources/extensions/gwd/bootstrap/agent-end-recovery.ts`, import vLLM Metal helpers:

```ts
import {
  applyVllmMetalQwen36ContextTarget,
  isVllmMetalQwen36ResourceFailure,
  matchesVllmMetalQwen36_27B,
  suppressVllmMetalQwen36ModelForRun,
} from "../vllm-metal-qwen36-profile.js";
```

After the existing Ollama local-resource fallback block and before generic transient handling, add:

```ts
  if (
    isAutoActive() &&
    isVllmMetalQwen36ResourceFailure(ctx.model?.provider, ctx.model?.id, rawErrorMsg)
  ) {
    const currentProvider = ctx.model?.provider;
    const currentId = ctx.model?.id;
    const availableModels = ctx.modelRegistry.getAvailable();
    const fallbackModel = availableModels.find((model: any) =>
      matchesVllmMetalQwen36_27B(model.id) &&
      typeof model.baseUrl === "string" &&
      model.baseUrl.startsWith("http://"),
    );

    if (!fallbackModel) {
      ctx.ui.notify(
        "vLLM Metal Qwen3.6 profile: Qwen3.6 27B is not available for fallback after 35B-A3B resource failure.",
        "warning",
      );
      return;
    }

    const prefs = loadEffectiveGWDPreferences(resolveAgentEndBasePath() ?? process.cwd())?.preferences;
    const fallbackToApply = applyVllmMetalQwen36ContextTarget(fallbackModel, prefs);
    const switched = await pi.setModel(fallbackToApply, { persist: false });
    if (!switched) {
      ctx.ui.notify(
        "vLLM Metal Qwen3.6 profile: failed to switch to Qwen3.6 27B fallback after 35B-A3B resource failure.",
        "warning",
      );
      return;
    }

    suppressVllmMetalQwen36ModelForRun(currentProvider, currentId);
    setCurrentDispatchedModelId({ provider: fallbackToApply.provider, id: fallbackToApply.id });
    ctx.ui.notify(
      "vLLM Metal Qwen3.6 profile: retrying on Qwen3.6 27B and suppressing 35B-A3B for this run after local resource failure.",
      "warning",
    );
    pi.sendMessage(
      { customType: "gwd-auto-timeout-recovery", content: "Retry the interrupted unit on the Qwen3.6 27B vLLM Metal fallback.", display: false },
      { triggerTurn: true },
    );
    return;
  }
```

- [ ] **Step 4: Clear vLLM Metal suppression on auto start and stop**

In `src/resources/extensions/gwd/auto.ts`, extend the Ollama import:

```ts
import { clearVllmMetalQwen36RuntimeSuppressions } from "./vllm-metal-qwen36-profile.js";
```

Call it beside `clearOllamaAppleSiliconRuntimeSuppressions()` in both stop/start lifecycle sites:

```ts
clearVllmMetalQwen36RuntimeSuppressions();
```

- [ ] **Step 5: Run recovery and profile tests**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/vllm-metal-qwen36-profile.test.ts src/resources/extensions/gwd/tests/provider-errors.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit recovery integration**

Run:

```bash
git add src/resources/extensions/gwd/bootstrap/agent-end-recovery.ts src/resources/extensions/gwd/auto.ts src/resources/extensions/gwd/tests/provider-errors.test.ts src/resources/extensions/gwd/tests/vllm-metal-qwen36-profile.test.ts
git commit -m "feat: recover vllm-metal qwen 35b resource failures"
```

---

### Task 5: Complete User Documentation And Usage Guide

**Files:**
- Modify: `docs/user-docs/providers.md`
- Modify: `docs/user-docs/custom-models.md`
- Modify: `gitbook/configuration/providers.md`
- Modify: `gitbook/configuration/custom-models.md`
- Modify: `docs/zh-CN/user-docs/providers.md`
- Modify: `docs/zh-CN/user-docs/custom-models.md`
- Modify: `README.md`

- [ ] **Step 1: Add the main English provider guide**

In both `docs/user-docs/providers.md` and `gitbook/configuration/providers.md`, under `### vLLM` and before `### SGLang`, insert:

````md
#### Apple Silicon vLLM Metal TurboQuant Qwen3.6 Profile

On a 48GB Apple Silicon machine, GWD can auto-detect a local `vllm-metal` server running Qwen3.6 with TurboQuant KV-cache compression.

Start the default 27B endpoint:

```bash
VLLM_METAL_USE_PAGED_ATTENTION=1 vllm serve Qwen/Qwen3.6-27B-FP8 \
  --host 127.0.0.1 \
  --port 8000 \
  --max-model-len 196608 \
  --reasoning-parser qwen3 \
  --additional-config '{"turboquant": true, "k_quant": "q8_0", "v_quant": "q3_0"}'
```

When GWD sees `Qwen/Qwen3.6-27B*` on `http://127.0.0.1:8000/v1` or `http://localhost:8000/v1`, auto-mode applies a 192K effective context target and uses 27B for light, standard, and heavy work.

An optional separate 35B-A3B endpoint can be used for heavy phases:

```bash
VLLM_METAL_USE_PAGED_ATTENTION=1 vllm serve Qwen/Qwen3.6-35B-A3B-FP8 \
  --host 127.0.0.1 \
  --port 8001 \
  --max-model-len 196608 \
  --reasoning-parser qwen3 \
  --additional-config '{"turboquant": true, "k_quant": "q8_0", "v_quant": "q3_0"}'
```

Running both endpoints at the same time is supported but not the default recommendation for 48GB machines. If 35B-A3B hits a local resource failure, GWD suppresses it for the current auto run and retries on 27B.

For custom ports, add explicit providers to `~/.gwd/agent/models.json`:

```json
{
  "providers": {
    "vllm-metal-27b": {
      "baseUrl": "http://127.0.0.1:8100/v1",
      "api": "openai-completions",
      "apiKey": "vllm",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false,
        "supportsUsageInStreaming": false,
        "thinkingFormat": "qwen-chat-template"
      },
      "models": [
        {
          "id": "Qwen/Qwen3.6-27B-FP8",
          "contextWindow": 196608,
          "maxTokens": 16384
        }
      ]
    }
  }
}
```

TurboQuant is a `vllm-metal` startup option. GWD does not enable it per request. If the server was started with a lower `--max-model-len`, set `context_window_override` in `.gwd/PREFERENCES.md` to match the real server limit or restart `vllm-metal` with the documented command.
````

- [ ] **Step 2: Add the English custom-port guide**

In both `docs/user-docs/custom-models.md` and `gitbook/configuration/custom-models.md`, after the "Minimal Example" section and before "Full Example", insert:

````md
## vLLM Metal Qwen3.6 TurboQuant On Apple Silicon

For the default 48GB Apple Silicon profile, start `vllm-metal` on port `8000` and GWD will auto-detect `Qwen/Qwen3.6-27B*`:

```bash
VLLM_METAL_USE_PAGED_ATTENTION=1 vllm serve Qwen/Qwen3.6-27B-FP8 \
  --host 127.0.0.1 \
  --port 8000 \
  --max-model-len 196608 \
  --reasoning-parser qwen3 \
  --additional-config '{"turboquant": true, "k_quant": "q8_0", "v_quant": "q3_0"}'
```

If you use custom ports, define providers explicitly in `~/.gwd/agent/models.json`:

```json
{
  "providers": {
    "vllm-metal-27b": {
      "baseUrl": "http://127.0.0.1:8100/v1",
      "api": "openai-completions",
      "apiKey": "vllm",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false,
        "supportsUsageInStreaming": false,
        "thinkingFormat": "qwen-chat-template"
      },
      "models": [
        {
          "id": "Qwen/Qwen3.6-27B-FP8",
          "name": "Qwen3.6 27B FP8 (vLLM Metal TurboQuant)",
          "reasoning": true,
          "input": ["text"],
          "contextWindow": 196608,
          "maxTokens": 16384,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
```

To route heavy phases to a separate 35B-A3B server, add a second provider:

```json
{
  "providers": {
    "vllm-metal-27b": {
      "baseUrl": "http://127.0.0.1:8100/v1",
      "api": "openai-completions",
      "apiKey": "vllm",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false,
        "supportsUsageInStreaming": false,
        "thinkingFormat": "qwen-chat-template"
      },
      "models": [
        {
          "id": "Qwen/Qwen3.6-27B-FP8",
          "contextWindow": 196608,
          "maxTokens": 16384
        }
      ]
    },
    "vllm-metal-35b": {
      "baseUrl": "http://127.0.0.1:8101/v1",
      "api": "openai-completions",
      "apiKey": "vllm",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false,
        "supportsUsageInStreaming": false,
        "thinkingFormat": "qwen-chat-template"
      },
      "models": [
        {
          "id": "Qwen/Qwen3.6-35B-A3B-FP8",
          "contextWindow": 196608,
          "maxTokens": 16384
        }
      ]
    }
  }
}
```

GWD does not start `vllm-metal` for you. Keep the `contextWindow` value aligned with the server's `--max-model-len`, or override it per project:

```md
---
context_window_override: 131072
---
```
````

- [ ] **Step 3: Add Simplified Chinese provider and custom-model guides**

In `docs/zh-CN/user-docs/providers.md`, under the vLLM section and before SGLang, insert:

````md
#### Apple Silicon vLLM Metal TurboQuant Qwen3.6 配置

在 48GB Apple Silicon 机器上，GWD 可以自动发现本机 `vllm-metal` 服务，并为启用 TurboQuant KV cache 压缩的 Qwen3.6 使用 192K 有效上下文。

启动默认 27B endpoint：

```bash
VLLM_METAL_USE_PAGED_ATTENTION=1 vllm serve Qwen/Qwen3.6-27B-FP8 \
  --host 127.0.0.1 \
  --port 8000 \
  --max-model-len 196608 \
  --reasoning-parser qwen3 \
  --additional-config '{"turboquant": true, "k_quant": "q8_0", "v_quant": "q3_0"}'
```

当 GWD 在 `http://127.0.0.1:8000/v1` 或 `http://localhost:8000/v1` 看到 `Qwen/Qwen3.6-27B*` 时，auto-mode 会自动使用 192K 上下文目标，并把 light、standard、heavy 工作都路由到 27B。

如果你明确启动第二个本机 endpoint，heavy 阶段可以使用 35B-A3B：

```bash
VLLM_METAL_USE_PAGED_ATTENTION=1 vllm serve Qwen/Qwen3.6-35B-A3B-FP8 \
  --host 127.0.0.1 \
  --port 8001 \
  --max-model-len 196608 \
  --reasoning-parser qwen3 \
  --additional-config '{"turboquant": true, "k_quant": "q8_0", "v_quant": "q3_0"}'
```

在 48GB 机器上同时运行两个 endpoint 不是默认推荐路径。如果 35B-A3B 遇到本机资源错误，GWD 会在当前 auto run 中抑制 35B-A3B，并回退到 27B。

TurboQuant 是 `vllm-metal` 启动参数，不是 GWD 的单次请求参数。如果服务启动时使用了更低的 `--max-model-len`，请在 `.gwd/PREFERENCES.md` 中设置匹配的 `context_window_override`，或按上面的命令重启 `vllm-metal`。
````

In `docs/zh-CN/user-docs/custom-models.md`, after the minimal local-model example and before the full example, insert:

````md
## Apple Silicon 上的 vLLM Metal Qwen3.6 TurboQuant

默认 48GB Apple Silicon profile 会自动发现 `8000` 端口上的 `Qwen/Qwen3.6-27B*`：

```bash
VLLM_METAL_USE_PAGED_ATTENTION=1 vllm serve Qwen/Qwen3.6-27B-FP8 \
  --host 127.0.0.1 \
  --port 8000 \
  --max-model-len 196608 \
  --reasoning-parser qwen3 \
  --additional-config '{"turboquant": true, "k_quant": "q8_0", "v_quant": "q3_0"}'
```

如果你使用自定义端口，需要在 `~/.gwd/agent/models.json` 中显式配置：

```json
{
  "providers": {
    "vllm-metal-27b": {
      "baseUrl": "http://127.0.0.1:8100/v1",
      "api": "openai-completions",
      "apiKey": "vllm",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false,
        "supportsUsageInStreaming": false,
        "thinkingFormat": "qwen-chat-template"
      },
      "models": [
        {
          "id": "Qwen/Qwen3.6-27B-FP8",
          "contextWindow": 196608,
          "maxTokens": 16384
        }
      ]
    }
  }
}
```

`contextWindow` 应与 `vllm-metal` 的 `--max-model-len` 保持一致；如果需要按项目降低上下文，使用 `.gwd/PREFERENCES.md`：

```md
---
context_window_override: 131072
---
```
````

- [ ] **Step 4: Add root README discoverability**

In `README.md`, under `### User Guides`, add this bullet after `Configuration`:

```md
- **[Provider Setup](./docs/user-docs/providers.md)** — provider setup including Ollama, vLLM Metal TurboQuant, LM Studio, and SGLang
```

Do not add a duplicate if the bullet already exists.

- [ ] **Step 5: Verify docs mention setup, autodetect, custom config, and override**

Run:

```bash
rg -n "vllm-metal|TurboQuant|196608|context_window_override|Qwen/Qwen3\\.6-27B-FP8|Qwen/Qwen3\\.6-35B-A3B-FP8" \
  docs/user-docs/providers.md \
  docs/user-docs/custom-models.md \
  gitbook/configuration/providers.md \
  gitbook/configuration/custom-models.md \
  docs/zh-CN/user-docs/providers.md \
  docs/zh-CN/user-docs/custom-models.md \
  README.md
```

Expected: output includes the English and Chinese provider guide sections, the custom-port `models.json` sections, and the root README Provider Setup link.

- [ ] **Step 6: Check Markdown whitespace for all touched docs**

Run:

```bash
git diff --check -- \
  docs/user-docs/providers.md \
  docs/user-docs/custom-models.md \
  gitbook/configuration/providers.md \
  gitbook/configuration/custom-models.md \
  docs/zh-CN/user-docs/providers.md \
  docs/zh-CN/user-docs/custom-models.md \
  README.md
```

Expected: PASS.

- [ ] **Step 7: Commit the complete documentation guide pass**

Run:

```bash
git add docs/user-docs/providers.md docs/user-docs/custom-models.md gitbook/configuration/providers.md gitbook/configuration/custom-models.md docs/zh-CN/user-docs/providers.md docs/zh-CN/user-docs/custom-models.md README.md
git commit -m "docs: guide vllm-metal turboquant qwen setup"
```

---

### Task 6: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run targeted profile and integration tests**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/vllm-metal-qwen36-profile.test.ts src/resources/extensions/gwd/tests/vllm-metal-autodetect.test.ts src/resources/extensions/gwd/tests/auto-model-selection.test.ts src/resources/extensions/gwd/tests/context-budget.test.ts src/resources/extensions/gwd/tests/provider-errors.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run extension typecheck**

Run:

```bash
npm run typecheck:extensions
```

Expected: PASS.

- [ ] **Step 3: Run changed-source test gate**

Run:

```bash
npm run test:changed:src
```

Expected: PASS.

- [ ] **Step 4: Check whitespace and staged state**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` exits 0. `git status --short` has no uncommitted implementation changes except any user-owned untracked files that pre-existed the work.

- [ ] **Step 5: Inspect commit sequence**

Run:

```bash
git log --oneline -8
```

Expected: recent commits include pure profile resolver, passive discovery, auto-mode integration, recovery integration, and provider docs.
