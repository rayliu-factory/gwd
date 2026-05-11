# Ollama Qwen3.6 Apple Silicon Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Ollama-only Apple Silicon safety profile that routes Qwen3.6 MLX NVFP4 27B/35B models without exhausting a 48GB Mac.

**Architecture:** Exact Ollama tag metadata will cap the two MLX NVFP4 Qwen3.6 tags at 64K and pass safe Ollama options. GWD auto-mode will synthesize an Ollama-only routing preset when the user has not configured explicit model routing, then suppress the 35B model for the current run after local resource failures.

**Tech Stack:** TypeScript, Node test runner, GWD extension runtime, Ollama native `/api/chat` provider, existing GWD model router and context budget modules.

---

## File Structure

- Modify `src/resources/extensions/ollama/model-capabilities.ts`: add exact tag capability matching before broad family matching.
- Modify `src/resources/extensions/ollama/tests/ollama-discovery.test.ts`: cover exact MLX NVFP4 tag metadata and broad `qwen3.6` fallback behavior.
- Create `src/resources/extensions/gwd/ollama-apple-silicon-profile.ts`: central constants, preset resolution, fallback policy, session-scoped 35B suppression, and local resource error matching.
- Create `src/resources/extensions/gwd/tests/ollama-apple-silicon-profile.test.ts`: pure tests for preset activation, preference opt-out, fallback policy, suppression, and resource error classification.
- Modify `src/resources/extensions/gwd/auto-model-selection.ts`: call the preset resolver, inject the synthesized routing config, and apply preset fallback rules.
- Modify `src/resources/extensions/gwd/tests/auto-model-selection.test.ts`: integration coverage for 27B standard routing, 35B heavy routing, explicit preference opt-out, missing 35B fallback, and suppression.
- Modify `src/resources/extensions/gwd/context-budget.ts`: keep `context_window_override` authoritative over discovered model metadata.
- Modify `src/resources/extensions/gwd/tests/context-budget.test.ts`: cover 64K Qwen MLX budgeting and override behavior.
- Modify `src/resources/extensions/gwd/bootstrap/agent-end-recovery.ts`: intercept 35B Ollama local resource failures before generic transient handling and retry the current unit on 27B.
- Modify `src/resources/extensions/gwd/auto.ts`: clear Ollama Apple Silicon runtime suppression on fresh auto start and stop.
- Modify `docs/user-docs/providers.md`: document the safe Ollama Qwen3.6 Apple Silicon profile and the exact model tags.

---

### Task 1: Exact Ollama Qwen3.6 MLX NVFP4 Capabilities

**Files:**
- Modify: `src/resources/extensions/ollama/model-capabilities.ts`
- Test: `src/resources/extensions/ollama/tests/ollama-discovery.test.ts`

- [ ] **Step 1: Write failing discovery tests for exact MLX NVFP4 tags**

Append these tests inside `describe("discoverModels — context window resolution", () => { ... })` in `src/resources/extensions/ollama/tests/ollama-discovery.test.ts`:

```ts
	it("uses exact Apple Silicon safety metadata for qwen3.6 27b coding nvfp4", async () => {
		let showCalled = false;
		const models = await discoverModels({
			listModels: async () => tagsStub("qwen3.6:27b-coding-nvfp4", "27B"),
			showModel: async () => { showCalled = true; throw new Error("should not be called"); },
		});

		assert.equal(models[0].id, "qwen3.6:27b-coding-nvfp4");
		assert.equal(models[0].contextWindow, 65536);
		assert.equal(models[0].maxTokens, 16384);
		assert.deepEqual(models[0].ollamaOptions, { num_ctx: 65536, keep_alive: "0" });
		assert.equal(showCalled, false);
	});

	it("uses exact Apple Silicon safety metadata for qwen3.6 35b a3b coding nvfp4", async () => {
		let showCalled = false;
		const models = await discoverModels({
			listModels: async () => tagsStub("qwen3.6:35b-a3b-coding-nvfp4", "35B"),
			showModel: async () => { showCalled = true; throw new Error("should not be called"); },
		});

		assert.equal(models[0].id, "qwen3.6:35b-a3b-coding-nvfp4");
		assert.equal(models[0].contextWindow, 65536);
		assert.equal(models[0].maxTokens, 16384);
		assert.deepEqual(models[0].ollamaOptions, { num_ctx: 65536, keep_alive: "0" });
		assert.equal(showCalled, false);
	});

	it("keeps broad qwen3.6 family metadata for non-Apple-Silicon-safety tags", async () => {
		const models = await discoverModels({
			listModels: async () => tagsStub("qwen3.6:latest", "27B"),
			showModel: async () => { throw new Error("should not be called"); },
		});

		assert.equal(models[0].contextWindow, 1048576);
		assert.equal(models[0].maxTokens, 32768);
		assert.deepEqual(models[0].ollamaOptions, { num_ctx: 1048576 });
	});
```

- [ ] **Step 2: Run the Ollama discovery test and verify it fails**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/ollama/tests/ollama-discovery.test.ts
```

Expected: FAIL. The first two new tests should receive `contextWindow: 1048576` from the broad `qwen3.6` family entry instead of `65536`.

- [ ] **Step 3: Add exact tag matching before family-prefix matching**

In `src/resources/extensions/ollama/model-capabilities.ts`, insert this constant just above `const KNOWN_MODELS`:

```ts
const EXACT_MODEL_CAPABILITIES: Record<string, ModelCapability> = {
	"qwen3.6:27b-coding-nvfp4": {
		contextWindow: 65536,
		maxTokens: 16384,
		ollamaOptions: { num_ctx: 65536, keep_alive: "0" },
	},
	"qwen3.6:35b-a3b-coding-nvfp4": {
		contextWindow: 65536,
		maxTokens: 16384,
		ollamaOptions: { num_ctx: 65536, keep_alive: "0" },
	},
};
```

Then replace `getModelCapabilities()` with:

```ts
export function getModelCapabilities(modelName: string): ModelCapability {
	const exact = EXACT_MODEL_CAPABILITIES[modelName.toLowerCase()];
	if (exact) return exact;

	// Strip tag (everything after the colon) for family matching
	const baseName = modelName.split(":")[0].toLowerCase();

	for (const [pattern, caps] of KNOWN_MODELS) {
		if (baseName === pattern || baseName.startsWith(pattern)) {
			return caps;
		}
	}

	return {};
}
```

- [ ] **Step 4: Run the Ollama discovery test and verify it passes**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/ollama/tests/ollama-discovery.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit exact tag capability changes**

Run:

```bash
git add src/resources/extensions/ollama/model-capabilities.ts src/resources/extensions/ollama/tests/ollama-discovery.test.ts
git commit -m "feat: cap Ollama Qwen MLX tags at safe context"
```

---

### Task 2: Ollama Apple Silicon Profile Module

**Files:**
- Create: `src/resources/extensions/gwd/ollama-apple-silicon-profile.ts`
- Test: `src/resources/extensions/gwd/tests/ollama-apple-silicon-profile.test.ts`

- [ ] **Step 1: Write failing pure tests for preset behavior**

Create `src/resources/extensions/gwd/tests/ollama-apple-silicon-profile.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";

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
```

- [ ] **Step 2: Run the new profile test and verify it fails**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/ollama-apple-silicon-profile.test.ts
```

Expected: FAIL with module not found for `../ollama-apple-silicon-profile.ts`.

- [ ] **Step 3: Implement the profile module**

Create `src/resources/extensions/gwd/ollama-apple-silicon-profile.ts`:

```ts
import type { DynamicRoutingConfig, RoutingDecision } from "./model-router.js";
import type { GSDPreferences } from "./preferences.js";
import { loadGlobalGSDPreferences, loadProjectGSDPreferences } from "./preferences.js";
import type { PreferredModelConfig } from "./auto-model-selection.js";

export const OLLAMA_PROVIDER = "ollama";
export const OLLAMA_QWEN36_27B_NVFP4 = "qwen3.6:27b-coding-nvfp4";
export const OLLAMA_QWEN36_35B_A3B_NVFP4 = "qwen3.6:35b-a3b-coding-nvfp4";
export const OLLAMA_QWEN36_27B_MODEL = `${OLLAMA_PROVIDER}/${OLLAMA_QWEN36_27B_NVFP4}`;
export const OLLAMA_QWEN36_35B_MODEL = `${OLLAMA_PROVIDER}/${OLLAMA_QWEN36_35B_A3B_NVFP4}`;

type ModelLike = { provider: string; id: string };

export interface OllamaAppleSiliconPreset {
  modelConfig: PreferredModelConfig;
  routingConfig: DynamicRoutingConfig;
  missingHeavyModel: boolean;
  heavySuppressed: boolean;
}

export interface OllamaAppleSiliconPresetInput {
  isAutoMode: boolean;
  prefs?: GSDPreferences;
  basePath?: string;
  availableModels: ModelLike[];
  autoModeStartModel: ModelLike | null;
  currentProvider?: string;
}

const suppressedForRun = new Set<string>();

function key(provider: string, id: string): string {
  return `${provider.toLowerCase()}/${id.toLowerCase()}`;
}

function hasModel(models: ModelLike[], id: string): boolean {
  return models.some((m) => m.provider === OLLAMA_PROVIDER && m.id === id);
}

function isOllamaSession(input: OllamaAppleSiliconPresetInput): boolean {
  return input.currentProvider === OLLAMA_PROVIDER || input.autoModeStartModel?.provider === OLLAMA_PROVIDER;
}

function hasExplicitModelRouting(input: OllamaAppleSiliconPresetInput): boolean {
  if (input.basePath !== undefined) {
    const globalPrefs = loadGlobalGSDPreferences()?.preferences;
    const projectPrefs = loadProjectGSDPreferences(input.basePath)?.preferences;
    return globalPrefs?.models !== undefined ||
      globalPrefs?.dynamic_routing !== undefined ||
      projectPrefs?.models !== undefined ||
      projectPrefs?.dynamic_routing !== undefined;
  }
  return input.prefs?.models !== undefined || input.prefs?.dynamic_routing !== undefined;
}

function isSuppressed(provider: string, id: string): boolean {
  return suppressedForRun.has(key(provider, id));
}

export function clearOllamaAppleSiliconRuntimeSuppressions(): void {
  suppressedForRun.clear();
}

export function suppressOllamaAppleSiliconModelForRun(provider: string | undefined, id: string | undefined): void {
  if (provider !== OLLAMA_PROVIDER || id !== OLLAMA_QWEN36_35B_A3B_NVFP4) return;
  suppressedForRun.add(key(provider, id));
}

export function resolveOllamaAppleSiliconPreset(
  input: OllamaAppleSiliconPresetInput,
): OllamaAppleSiliconPreset | undefined {
  if (!input.isAutoMode) return undefined;
  if (!isOllamaSession(input)) return undefined;
  if (hasExplicitModelRouting(input)) return undefined;
  if (!hasModel(input.availableModels, OLLAMA_QWEN36_27B_NVFP4)) return undefined;

  const hasHeavy = hasModel(input.availableModels, OLLAMA_QWEN36_35B_A3B_NVFP4);
  const heavySuppressed = isSuppressed(OLLAMA_PROVIDER, OLLAMA_QWEN36_35B_A3B_NVFP4);
  const useHeavy = hasHeavy && !heavySuppressed;
  const heavyModel = useHeavy ? OLLAMA_QWEN36_35B_MODEL : OLLAMA_QWEN36_27B_MODEL;

  return {
    modelConfig: {
      primary: heavyModel,
      fallbacks: useHeavy ? [OLLAMA_QWEN36_27B_MODEL] : [],
      source: "synthesized",
    },
    routingConfig: {
      enabled: true,
      cross_provider: false,
      capability_routing: false,
      tier_models: {
        light: OLLAMA_QWEN36_27B_MODEL,
        standard: OLLAMA_QWEN36_27B_MODEL,
        heavy: heavyModel,
      },
    },
    missingHeavyModel: !hasHeavy,
    heavySuppressed,
  };
}

export function adjustOllamaAppleSiliconFallbacks<T extends RoutingDecision>(decision: T): T {
  if (decision.modelId === OLLAMA_QWEN36_35B_MODEL) {
    return { ...decision, fallbacks: [OLLAMA_QWEN36_27B_MODEL] };
  }
  if (decision.modelId === OLLAMA_QWEN36_27B_MODEL) {
    return { ...decision, fallbacks: [] };
  }
  return decision;
}

const OLLAMA_RESOURCE_RE =
  /\b(?:oom|out of memory)\b|failed to allocate|cannot allocate|memory allocation|requires more system memory|llama runner.*(?:terminated|exited|failed)|runner process.*(?:terminated|exited|failed)|failed to load model|model load failed|context (?:window|length).*exceed|context overflow|input.*too large|500 internal server error/i;

export function isOllamaAppleSiliconResourceFailure(
  provider: string | undefined,
  id: string | undefined,
  errorMessage: string,
): boolean {
  return provider === OLLAMA_PROVIDER &&
    id === OLLAMA_QWEN36_35B_A3B_NVFP4 &&
    OLLAMA_RESOURCE_RE.test(errorMessage);
}
```

- [ ] **Step 4: Run the new profile test and verify it passes**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/ollama-apple-silicon-profile.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the profile module**

Run:

```bash
git add src/resources/extensions/gwd/ollama-apple-silicon-profile.ts src/resources/extensions/gwd/tests/ollama-apple-silicon-profile.test.ts
git commit -m "feat: add Ollama Qwen Apple Silicon profile"
```

---

### Task 3: Auto-Mode Model Selection Integration

**Files:**
- Modify: `src/resources/extensions/gwd/model-router.ts`
- Modify: `src/resources/extensions/gwd/auto-model-selection.ts`
- Modify: `src/resources/extensions/gwd/tests/auto-model-selection.test.ts`

- [ ] **Step 1: Add failing auto-selection tests for the preset**

Append these tests to `src/resources/extensions/gwd/tests/auto-model-selection.test.ts`:

```ts
test("selectAndApplyModel auto-synthesizes Ollama Qwen Apple profile for standard work", async (t) => {
  const originalCwd = process.cwd();
  const originalGwdHome = process.env.GWD_HOME;
  const tempProject = makeTempDir("gwd-ollama-apple-profile-");
  const tempGwdHome = makeTempDir("gwd-ollama-apple-home-");
  const setModelCalls: string[] = [];
  const notifications: Array<{ message: string; level: string }> = [];

  t.after(() => {
    process.chdir(originalCwd);
    if (originalGwdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = originalGwdHome;
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(tempGwdHome, { recursive: true, force: true });
  });

  mkdirSync(join(tempProject, ".gwd"), { recursive: true });
  process.env.GWD_HOME = tempGwdHome;
  process.chdir(tempProject);

  const availableModels = [
    { id: "qwen3.6:27b-coding-nvfp4", provider: "ollama", api: "ollama-chat" },
    { id: "qwen3.6:35b-a3b-coding-nvfp4", provider: "ollama", api: "ollama-chat" },
  ];

  const result = await selectAndApplyModel(
    {
      modelRegistry: { getAvailable: () => availableModels },
      sessionManager: { getSessionId: () => "test-session" },
      ui: { notify: (message: string, level: string) => notifications.push({ message, level }) },
      model: { provider: "ollama", id: "qwen3.6:27b-coding-nvfp4", api: "ollama-chat" },
    } as any,
    {
      setModel: async (model: { provider: string; id: string }) => {
        setModelCalls.push(`${model.provider}/${model.id}`);
        return true;
      },
      emitBeforeModelSelect: async () => undefined,
      getActiveTools: () => [],
      emitAdjustToolSet: async () => undefined,
      setActiveTools: () => {},
    } as any,
    "execute-task",
    "M001/S01/T01",
    tempProject,
    undefined,
    false,
    { provider: "ollama", id: "qwen3.6:27b-coding-nvfp4" },
    undefined,
    true,
  );

  assert.deepEqual(setModelCalls, ["ollama/qwen3.6:27b-coding-nvfp4"]);
  assert.equal(result.appliedModel?.id, "qwen3.6:27b-coding-nvfp4");
  assert.equal(result.routing?.tier, "standard");
  assert.equal(notifications.some((n) => /missing.*35b/i.test(n.message)), false);
});

test("selectAndApplyModel auto-synthesizes Ollama Qwen Apple profile for heavy work", async (t) => {
  const originalCwd = process.cwd();
  const originalGwdHome = process.env.GWD_HOME;
  const tempProject = makeTempDir("gwd-ollama-apple-profile-");
  const tempGwdHome = makeTempDir("gwd-ollama-apple-home-");
  const setModelCalls: string[] = [];

  t.after(() => {
    process.chdir(originalCwd);
    if (originalGwdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = originalGwdHome;
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(tempGwdHome, { recursive: true, force: true });
  });

  mkdirSync(join(tempProject, ".gwd"), { recursive: true });
  process.env.GWD_HOME = tempGwdHome;
  process.chdir(tempProject);

  const availableModels = [
    { id: "qwen3.6:27b-coding-nvfp4", provider: "ollama", api: "ollama-chat" },
    { id: "qwen3.6:35b-a3b-coding-nvfp4", provider: "ollama", api: "ollama-chat" },
  ];

  const result = await selectAndApplyModel(
    {
      modelRegistry: { getAvailable: () => availableModels },
      sessionManager: { getSessionId: () => "test-session" },
      ui: { notify: () => {} },
      model: { provider: "ollama", id: "qwen3.6:27b-coding-nvfp4", api: "ollama-chat" },
    } as any,
    {
      setModel: async (model: { provider: string; id: string }) => {
        setModelCalls.push(`${model.provider}/${model.id}`);
        return true;
      },
      emitBeforeModelSelect: async () => undefined,
      getActiveTools: () => [],
      emitAdjustToolSet: async () => undefined,
      setActiveTools: () => {},
    } as any,
    "replan-slice",
    "M001/S01",
    tempProject,
    undefined,
    false,
    { provider: "ollama", id: "qwen3.6:27b-coding-nvfp4" },
    undefined,
    true,
  );

  assert.deepEqual(setModelCalls, ["ollama/qwen3.6:35b-a3b-coding-nvfp4"]);
  assert.equal(result.appliedModel?.id, "qwen3.6:35b-a3b-coding-nvfp4");
  assert.equal(result.routing?.tier, "heavy");
});

test("selectAndApplyModel falls back to 27B for heavy work when 35B tag is missing", async (t) => {
  const originalCwd = process.cwd();
  const originalGwdHome = process.env.GWD_HOME;
  const tempProject = makeTempDir("gwd-ollama-apple-profile-");
  const tempGwdHome = makeTempDir("gwd-ollama-apple-home-");
  const setModelCalls: string[] = [];
  const notifications: string[] = [];

  t.after(() => {
    process.chdir(originalCwd);
    if (originalGwdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = originalGwdHome;
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(tempGwdHome, { recursive: true, force: true });
  });

  mkdirSync(join(tempProject, ".gwd"), { recursive: true });
  process.env.GWD_HOME = tempGwdHome;
  process.chdir(tempProject);

  const result = await selectAndApplyModel(
    {
      modelRegistry: { getAvailable: () => [{ id: "qwen3.6:27b-coding-nvfp4", provider: "ollama", api: "ollama-chat" }] },
      sessionManager: { getSessionId: () => "test-session" },
      ui: { notify: (message: string) => notifications.push(message) },
      model: { provider: "ollama", id: "qwen3.6:27b-coding-nvfp4", api: "ollama-chat" },
    } as any,
    {
      setModel: async (model: { provider: string; id: string }) => {
        setModelCalls.push(`${model.provider}/${model.id}`);
        return true;
      },
      emitBeforeModelSelect: async () => undefined,
      getActiveTools: () => [],
      emitAdjustToolSet: async () => undefined,
      setActiveTools: () => {},
    } as any,
    "replan-slice",
    "M001/S01",
    tempProject,
    undefined,
    false,
    { provider: "ollama", id: "qwen3.6:27b-coding-nvfp4" },
    undefined,
    true,
  );

  assert.deepEqual(setModelCalls, ["ollama/qwen3.6:27b-coding-nvfp4"]);
  assert.equal(result.appliedModel?.id, "qwen3.6:27b-coding-nvfp4");
  assert.ok(notifications.some((message) => message.includes("qwen3.6:35b-a3b-coding-nvfp4")));
});

test("selectAndApplyModel does not synthesize Ollama Apple profile when dynamic_routing is explicit", async (t) => {
  const originalCwd = process.cwd();
  const originalGwdHome = process.env.GWD_HOME;
  const tempProject = makeTempDir("gwd-ollama-apple-profile-");
  const tempGwdHome = makeTempDir("gwd-ollama-apple-home-");
  const setModelCalls: string[] = [];

  t.after(() => {
    process.chdir(originalCwd);
    if (originalGwdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = originalGwdHome;
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(tempGwdHome, { recursive: true, force: true });
  });

  mkdirSync(join(tempProject, ".gwd"), { recursive: true });
  writeFileSync(
    join(tempProject, ".gwd", "PREFERENCES.md"),
    ["---", "dynamic_routing:", "  enabled: false", "---"].join("\n"),
    "utf-8",
  );
  process.env.GWD_HOME = tempGwdHome;
  process.chdir(tempProject);

  await selectAndApplyModel(
    {
      modelRegistry: { getAvailable: () => [
        { id: "qwen3.6:27b-coding-nvfp4", provider: "ollama", api: "ollama-chat" },
        { id: "qwen3.6:35b-a3b-coding-nvfp4", provider: "ollama", api: "ollama-chat" },
      ] },
      sessionManager: { getSessionId: () => "test-session" },
      ui: { notify: () => {} },
      model: { provider: "ollama", id: "qwen3.6:27b-coding-nvfp4", api: "ollama-chat" },
    } as any,
    {
      setModel: async (model: { provider: string; id: string }) => {
        setModelCalls.push(`${model.provider}/${model.id}`);
        return true;
      },
      emitBeforeModelSelect: async () => undefined,
      getActiveTools: () => [],
      emitAdjustToolSet: async () => undefined,
      setActiveTools: () => {},
    } as any,
    "replan-slice",
    "M001/S01",
    tempProject,
    undefined,
    false,
    { provider: "ollama", id: "qwen3.6:27b-coding-nvfp4" },
    undefined,
    true,
  );

  assert.deepEqual(setModelCalls, ["ollama/qwen3.6:27b-coding-nvfp4"]);
});
```

- [ ] **Step 2: Run auto-model-selection tests and verify the new tests fail**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/auto-model-selection.test.ts
```

Expected: FAIL because the preset is not wired into `selectAndApplyModel`.

- [ ] **Step 3: Add Qwen MLX model tier entries**

In `src/resources/extensions/gwd/model-router.ts`, add these entries to `MODEL_CAPABILITY_TIER`:

```ts
  "qwen3.6:27b-coding-nvfp4": "standard",
  "qwen3.6:35b-a3b-coding-nvfp4": "heavy",
```

Place the 27B entry with standard-tier models and the 35B entry with heavy-tier models.

- [ ] **Step 4: Wire the preset into model selection**

In `src/resources/extensions/gwd/auto-model-selection.ts`, add imports:

```ts
import {
  adjustOllamaAppleSiliconFallbacks,
  resolveOllamaAppleSiliconPreset,
} from "./ollama-apple-silicon-profile.js";
```

Inside `selectAndApplyModel`, move `const availableModels = ctx.modelRegistry.getAvailable();` above model config resolution, then replace the existing model config setup with:

```ts
  const availableModels = ctx.modelRegistry.getAvailable();
  const ollamaAppleSiliconPreset = effectiveSessionModelOverride
    ? undefined
    : resolveOllamaAppleSiliconPreset({
        isAutoMode,
        prefs,
        basePath,
        availableModels,
        autoModeStartModel,
        currentProvider: ctx.model?.provider,
      });
  if (ollamaAppleSiliconPreset?.missingHeavyModel) {
    ctx.ui.notify(
      "Ollama Apple Silicon profile: qwen3.6:35b-a3b-coding-nvfp4 is not installed; heavy work will use qwen3.6:27b-coding-nvfp4.",
      "warning",
    );
  } else if (ollamaAppleSiliconPreset?.heavySuppressed) {
    ctx.ui.notify(
      "Ollama Apple Silicon profile: qwen3.6:35b-a3b-coding-nvfp4 is suppressed for this run after a local resource failure; heavy work will use qwen3.6:27b-coding-nvfp4.",
      "warning",
    );
  }
  const modelConfig = effectiveSessionModelOverride
    ? undefined
    : (ollamaAppleSiliconPreset?.modelConfig ?? resolvePreferredModelConfig(unitType, autoModeStartModel, isAutoMode));
```

Remove the later duplicate `const availableModels = ctx.modelRegistry.getAvailable();` inside `if (modelConfig)`.

Inside the `if (modelConfig) { ... }` block, replace:

```ts
    const routingConfig = resolveDynamicRoutingConfig();
```

with:

```ts
    const routingConfig = {
      ...resolveDynamicRoutingConfig(),
      ...(ollamaAppleSiliconPreset?.routingConfig ?? {}),
    };
```

After `resolveModelForComplexity(...)` assigns `routingResult`, add:

```ts
          if (ollamaAppleSiliconPreset) {
            routingResult = adjustOllamaAppleSiliconFallbacks(routingResult);
          }
```

Place that adjustment after the hook/non-hook selection branch and before `if (routingResult.wasDowngraded)`.

- [ ] **Step 5: Run auto-model-selection tests and verify they pass**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/auto-model-selection.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit auto-selection integration**

Run:

```bash
git add src/resources/extensions/gwd/model-router.ts src/resources/extensions/gwd/auto-model-selection.ts src/resources/extensions/gwd/tests/auto-model-selection.test.ts
git commit -m "feat: route Ollama Qwen MLX profile in auto mode"
```

---

### Task 4: Context Budget Override Preservation

**Files:**
- Modify: `src/resources/extensions/gwd/context-budget.ts`
- Test: `src/resources/extensions/gwd/tests/context-budget.test.ts`

- [ ] **Step 1: Add failing context-window override tests**

Append these tests inside `describe("context-budget: resolveExecutorContextWindow", () => { ... })` in `src/resources/extensions/gwd/tests/context-budget.test.ts`:

```ts
  it("uses the 64K context window from the configured Ollama Qwen MLX executor model", () => {
    const registry = makeRegistry([
      makeModel("qwen3.6:27b-coding-nvfp4", "ollama", 65_536),
    ]);
    const prefs: MinimalPreferences = {
      models: { execution: "ollama/qwen3.6:27b-coding-nvfp4" },
    };

    const result = resolveExecutorContextWindow(registry, prefs);
    assert.equal(result, 65_536);
  });

  it("context_window_override wins over discovered Ollama Qwen MLX context metadata", () => {
    const registry = makeRegistry([
      makeModel("qwen3.6:27b-coding-nvfp4", "ollama", 65_536),
    ]);
    const prefs: MinimalPreferences = {
      context_window_override: 131_072,
      models: { execution: "ollama/qwen3.6:27b-coding-nvfp4" },
    };

    const result = resolveExecutorContextWindow(registry, prefs);
    assert.equal(result, 131_072);
  });
```

- [ ] **Step 2: Run the context-budget test and verify the override test fails**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/context-budget.test.ts
```

Expected: FAIL. The new `context_window_override` test should receive `65536` from the configured model instead of `131072`.

- [ ] **Step 3: Make context_window_override authoritative**

In `src/resources/extensions/gwd/context-budget.ts`, add `context_window_override` to `MinimalPreferences`:

```ts
export interface MinimalPreferences {
  context_window_override?: number;
  models?: {
    execution?: string | { model: string; fallbacks?: string[] };
  };
}
```

Then insert this block at the start of `resolveExecutorContextWindow`, before the configured executor model lookup:

```ts
  if (preferences?.context_window_override !== undefined && preferences.context_window_override > 0) {
    return preferences.context_window_override;
  }
```

Do not pass the override through `resolveEffectiveContextWindow`; the override is an explicit user opt-in and must be able to raise or lower the discovered window.

- [ ] **Step 4: Run the context-budget test and verify it passes**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/context-budget.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit context-budget override preservation**

Run:

```bash
git add src/resources/extensions/gwd/context-budget.ts src/resources/extensions/gwd/tests/context-budget.test.ts
git commit -m "fix: preserve context window override for local models"
```

---

### Task 5: 35B Resource-Failure Fallback And Runtime Reset

**Files:**
- Modify: `src/resources/extensions/gwd/bootstrap/agent-end-recovery.ts`
- Modify: `src/resources/extensions/gwd/auto.ts`
- Modify: `src/resources/extensions/gwd/tests/ollama-apple-silicon-profile.test.ts`
- Modify: `src/resources/extensions/gwd/tests/provider-errors.test.ts`

- [ ] **Step 1: Add a focused pure test for suppression reset**

Append this test to `src/resources/extensions/gwd/tests/ollama-apple-silicon-profile.test.ts`:

```ts
test("clearOllamaAppleSiliconRuntimeSuppressions restores 35B routing after a prior suppression", () => {
  suppressOllamaAppleSiliconModelForRun("ollama", OLLAMA_QWEN36_35B_A3B_NVFP4);
  clearOllamaAppleSiliconRuntimeSuppressions();

  const preset = resolveOllamaAppleSiliconPreset({
    isAutoMode: true,
    prefs: undefined,
    availableModels: models,
    autoModeStartModel: { provider: "ollama", id: OLLAMA_QWEN36_27B_NVFP4 },
    currentProvider: "ollama",
  });

  assert.ok(preset);
  assert.equal(preset.routingConfig.tier_models?.heavy, OLLAMA_QWEN36_35B_MODEL);
});
```

- [ ] **Step 2: Add provider-error source checks for recovery integration**

Append this source-level regression test to `src/resources/extensions/gwd/tests/provider-errors.test.ts`:

```ts
test("agent-end recovery handles Ollama Apple Silicon 35B resource failures before generic transient return", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const testDir = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(testDir, "../bootstrap/agent-end-recovery.ts"), "utf-8");

  const localFailureIndex = source.indexOf("isOllamaAppleSiliconResourceFailure(");
  const transientReturnIndex = source.indexOf("if (isTransient(cls) && cls.kind !== \"rate-limit\")");

  assert.ok(localFailureIndex > 0, "agent-end recovery must check Ollama Apple Silicon resource failures");
  assert.ok(transientReturnIndex > 0, "generic transient early return must remain present");
  assert.ok(
    localFailureIndex < transientReturnIndex,
    "Ollama local resource fallback must run before generic transient handling returns",
  );
});
```

- [ ] **Step 3: Run targeted tests and verify the provider-errors test fails**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/ollama-apple-silicon-profile.test.ts src/resources/extensions/gwd/tests/provider-errors.test.ts
```

Expected: FAIL because `agent-end-recovery.ts` does not yet call `isOllamaAppleSiliconResourceFailure`.

- [ ] **Step 4: Integrate local resource fallback in agent-end recovery**

In `src/resources/extensions/gwd/bootstrap/agent-end-recovery.ts`, add imports:

```ts
import {
  OLLAMA_QWEN36_27B_MODEL,
  isOllamaAppleSiliconResourceFailure,
  suppressOllamaAppleSiliconModelForRun,
} from "../ollama-apple-silicon-profile.js";
```

After `const cls = classifyError(rawErrorMsg, explicitRetryAfterMs);`, insert:

```ts
    if (isOllamaAppleSiliconResourceFailure(ctx.model?.provider, ctx.model?.id, rawErrorMsg)) {
      const currentProvider = ctx.model?.provider;
      const currentId = ctx.model?.id;
      suppressOllamaAppleSiliconModelForRun(currentProvider, currentId);

      const fallback = resolveModelId(
        OLLAMA_QWEN36_27B_MODEL,
        ctx.modelRegistry.getAvailable(),
        "ollama",
      );
      if (fallback) {
        const ok = await pi.setModel(fallback, { persist: false });
        if (ok) {
          setCurrentDispatchedModelId({ provider: fallback.provider, id: fallback.id });
          ctx.ui.notify(
            "Ollama Apple Silicon profile: qwen3.6:35b-a3b-coding-nvfp4 hit local resource limits; retrying on qwen3.6:27b-coding-nvfp4 and suppressing 35B for this run.",
            "warning",
          );
          pi.sendMessage(
            { customType: "gwd-auto-timeout-recovery", content: "Continue execution on the 27B Ollama fallback.", display: false },
            { triggerTurn: true },
          );
          return;
        }
      }

      ctx.ui.notify(
        "Ollama Apple Silicon profile: qwen3.6:35b-a3b-coding-nvfp4 hit local resource limits, but qwen3.6:27b-coding-nvfp4 is not available for fallback.",
        "warning",
      );
    }
```

This block must stay before the existing `if (isTransient(cls) && cls.kind !== "rate-limit") { return; }`.

- [ ] **Step 5: Clear runtime suppression on fresh auto start and stop**

In `src/resources/extensions/gwd/auto.ts`, add this import:

```ts
import { clearOllamaAppleSiliconRuntimeSuppressions } from "./ollama-apple-silicon-profile.js";
```

In `startAuto`, replace:

```ts
  if (!s.paused) clearToolBaseline(pi);
```

with:

```ts
  if (!s.paused) {
    clearToolBaseline(pi);
    clearOllamaAppleSiliconRuntimeSuppressions();
  }
```

In `stopAuto`, immediately after `if (pi) clearToolBaseline(pi);`, add:

```ts
    clearOllamaAppleSiliconRuntimeSuppressions();
```

- [ ] **Step 6: Run targeted tests and verify they pass**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/ollama-apple-silicon-profile.test.ts src/resources/extensions/gwd/tests/provider-errors.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit recovery integration**

Run:

```bash
git add src/resources/extensions/gwd/bootstrap/agent-end-recovery.ts src/resources/extensions/gwd/auto.ts src/resources/extensions/gwd/tests/ollama-apple-silicon-profile.test.ts src/resources/extensions/gwd/tests/provider-errors.test.ts
git commit -m "feat: fallback Ollama Qwen 35B resource failures"
```

---

### Task 6: Provider Documentation

**Files:**
- Modify: `docs/user-docs/providers.md`

- [ ] **Step 1: Add Ollama Apple Silicon profile documentation**

In `docs/user-docs/providers.md`, under `### Ollama` and before `### LM Studio`, insert:

```md
#### Apple Silicon Qwen3.6 48GB Profile

On Apple Silicon machines with 48GB RAM, GWD auto-mode has a conservative Ollama preset for the MLX NVFP4 Qwen3.6 coding tags:

```bash
ollama pull qwen3.6:27b-coding-nvfp4
ollama pull qwen3.6:35b-a3b-coding-nvfp4
```

When both tags are installed and no explicit `models` or `dynamic_routing` preferences are set, auto-mode uses:

| Tier | Model |
| --- | --- |
| Light | `qwen3.6:27b-coding-nvfp4` |
| Standard | `qwen3.6:27b-coding-nvfp4` |
| Heavy | `qwen3.6:35b-a3b-coding-nvfp4` |

Both tags are registered with a 64K effective context and `keep_alive: "0"` so Ollama unloads the active model after each request. This trades speed for memory safety and avoids keeping 27B and 35B resident at the same time.

The 64K context is a safe execution envelope, not a promise that a large repository fits into one prompt. Large repositories should still be handled through smaller slices, targeted file reads, and verification-focused task plans. To opt into a larger context, set `context_window_override` in `.gwd/PREFERENCES.md`; this can increase memory pressure.
```

- [ ] **Step 2: Check the docs mention the exact tags and override path**

Run:

```bash
rg -n "qwen3\\.6:27b-coding-nvfp4|qwen3\\.6:35b-a3b-coding-nvfp4|context_window_override" docs/user-docs/providers.md
```

Expected: output includes all three strings in the Ollama section.

- [ ] **Step 3: Commit provider docs**

Run:

```bash
git add docs/user-docs/providers.md
git commit -m "docs: document Ollama Qwen Apple Silicon profile"
```

---

### Task 7: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run targeted source tests**

Run:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/ollama/tests/ollama-discovery.test.ts src/resources/extensions/gwd/tests/ollama-apple-silicon-profile.test.ts src/resources/extensions/gwd/tests/auto-model-selection.test.ts src/resources/extensions/gwd/tests/context-budget.test.ts src/resources/extensions/gwd/tests/provider-errors.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run extension typecheck**

Run:

```bash
npm run typecheck:extensions
```

Expected: PASS.

- [ ] **Step 3: Run changed source test gate**

Run:

```bash
npm run test:changed:src
```

Expected: PASS.

- [ ] **Step 4: Inspect git history and working tree**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: `git status --short` has no uncommitted implementation changes. The last commits should include the exact tag capabilities, profile module, selection integration, context override, recovery fallback, and docs commits.
