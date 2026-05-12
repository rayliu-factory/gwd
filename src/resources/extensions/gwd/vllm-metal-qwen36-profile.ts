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
      (
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "localhost" ||
        parsed.hostname === "::1" ||
        parsed.hostname === "[::1]"
      );
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

function isLegacyVllmMetal35B(provider: string | undefined, id: string | undefined): boolean {
  return typeof provider === "string" && provider.toLowerCase().startsWith("vllm-metal") &&
    matchesVllmMetalQwen36_35BA3B(id);
}

export function isVllmMetalQwen36ResourceFailure(model: ModelLike, errorMessage: string): boolean;
export function isVllmMetalQwen36ResourceFailure(
  provider: string | undefined,
  id: string | undefined,
  errorMessage: string,
): boolean;
export function isVllmMetalQwen36ResourceFailure(
  modelOrProvider: ModelLike | string | undefined,
  idOrErrorMessage: string | undefined,
  maybeErrorMessage?: string,
): boolean {
  const model = typeof modelOrProvider === "object" && modelOrProvider !== null ? modelOrProvider : undefined;
  const errorMessage = model ? idOrErrorMessage : maybeErrorMessage;
  const eligible = model
    ? isEligible35B(model)
    : isLegacyVllmMetal35B(modelOrProvider, idOrErrorMessage);
  if (!eligible || !errorMessage) return false;
  return RESOURCE_RE.test(errorMessage);
}
