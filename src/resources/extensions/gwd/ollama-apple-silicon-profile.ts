import type { DynamicRoutingConfig, RoutingDecision } from "./model-router.js";
import type { GWDPreferences } from "./preferences.js";
import { loadGlobalGWDPreferences, loadProjectGWDPreferences } from "./preferences.js";
import type { PreferredModelConfig } from "./auto-model-selection.js";

export const OLLAMA_PROVIDER = "ollama";
export const OLLAMA_QWEN36_27B_NVFP4 = "qwen3.6:27b-coding-nvfp4";
export const OLLAMA_QWEN36_35B_A3B_NVFP4 = "qwen3.6:35b-a3b-coding-nvfp4";
export const OLLAMA_QWEN36_27B_MODEL = `${OLLAMA_PROVIDER}/${OLLAMA_QWEN36_27B_NVFP4}`;
export const OLLAMA_QWEN36_35B_MODEL = `${OLLAMA_PROVIDER}/${OLLAMA_QWEN36_35B_A3B_NVFP4}`;

type ModelLike = { provider: string; id: string };
type OllamaAppleSiliconModelLike = ModelLike & {
  contextWindow?: number;
  providerOptions?: Record<string, unknown>;
};

export interface OllamaAppleSiliconPreset {
  modelConfig: PreferredModelConfig;
  routingConfig: DynamicRoutingConfig;
  missingHeavyModel: boolean;
  heavySuppressed: boolean;
}

export interface OllamaAppleSiliconPresetInput {
  isAutoMode: boolean;
  prefs?: GWDPreferences;
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

function isOllamaAppleSiliconQwen(model: ModelLike): boolean {
  return model.provider === OLLAMA_PROVIDER &&
    (model.id === OLLAMA_QWEN36_27B_NVFP4 || model.id === OLLAMA_QWEN36_35B_A3B_NVFP4);
}

export function applyOllamaAppleSiliconContextOverride<T extends OllamaAppleSiliconModelLike>(
  model: T,
  prefs: GWDPreferences | undefined,
): T {
  const contextWindow = prefs?.context_window_override;
  if (contextWindow === undefined || contextWindow <= 0 || !Number.isFinite(contextWindow)) {
    return model;
  }
  if (!isOllamaAppleSiliconQwen(model)) return model;

  return {
    ...model,
    contextWindow,
    providerOptions: {
      ...(model.providerOptions ?? {}),
      num_ctx: contextWindow,
    },
  };
}

function hasBurnMaxDefaultRouting(prefs: GWDPreferences | undefined): boolean {
  const routing = prefs?.dynamic_routing;
  if (prefs?.token_profile !== "burn-max" || !routing) return false;
  const keys = Object.keys(routing).filter((key) => (routing as Record<string, unknown>)[key] !== undefined);
  return keys.length === 1 && routing.enabled === false;
}

function hasModelOverride(prefs: GWDPreferences | undefined): boolean {
  return !!prefs?.models && Object.keys(prefs.models).length > 0;
}

function hasRoutingOverride(prefs: GWDPreferences | undefined): boolean {
  return hasModelOverride(prefs) ||
    (prefs?.dynamic_routing !== undefined && !hasBurnMaxDefaultRouting(prefs));
}

function hasExplicitModelRouting(input: OllamaAppleSiliconPresetInput): boolean {
  if (hasRoutingOverride(input.prefs)) {
    return true;
  }

  if (input.basePath !== undefined) {
    const globalPrefs = loadGlobalGWDPreferences()?.preferences;
    const projectPrefs = loadProjectGWDPreferences(input.basePath)?.preferences;
    if (hasRoutingOverride(globalPrefs) || hasRoutingOverride(projectPrefs)) {
      return true;
    }
  }

  return false;
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
  /\b(?:oom|out of memory)\b|failed to allocate|cannot allocate|\ballocation(?: failed)?\b|requires more system memory|llama runner.*(?:terminated|exited|failed)|runner process.*(?:terminated|exited|failed)|runner termination|\bmodel load(?: error| failed)?\b|failed to load model/i;

export function isOllamaAppleSiliconResourceFailure(
  provider: string | undefined,
  id: string | undefined,
  errorMessage: string,
): boolean {
  return provider === OLLAMA_PROVIDER &&
    id === OLLAMA_QWEN36_35B_A3B_NVFP4 &&
    OLLAMA_RESOURCE_RE.test(errorMessage);
}
