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
  unregisterProvider?: (name: string) => void;
}

function providerNameForModel(id: string): string | undefined {
  if (matchesVllmMetalQwen36_27B(id)) return "vllm-metal-27b";
  if (matchesVllmMetalQwen36_35BA3B(id)) return "vllm-metal-35b";
  return undefined;
}

const MANAGED_PROVIDER_NAMES = ["vllm-metal-27b", "vllm-metal-35b"] as const;
const registeredManagedProviders = new Set<string>();

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
  const discoveredNames = new Set<string>();

  const discoveries = await Promise.all(
    baseUrls.map(async (baseUrl) => ({
      baseUrl,
      modelIds: await fetchModels(baseUrl, fetchImpl, timeoutMs),
    })),
  );

  for (const { baseUrl, modelIds } of discoveries) {
    for (const id of modelIds) {
      const providerName = providerNameForModel(id);
      if (!providerName || registeredNames.has(providerName)) continue;
      registeredNames.add(providerName);
      discoveredNames.add(providerName);
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
            thinkingFormat: "qwen",
          },
        }],
      });
      registeredManagedProviders.add(providerName);
    }
  }

  if (!input.unregisterProvider) return;

  for (const providerName of MANAGED_PROVIDER_NAMES) {
    if (!registeredManagedProviders.has(providerName) || discoveredNames.has(providerName)) continue;
    input.unregisterProvider(providerName);
    registeredManagedProviders.delete(providerName);
  }
}
