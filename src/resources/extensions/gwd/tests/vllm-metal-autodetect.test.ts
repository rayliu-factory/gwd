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

function deferredResponse(): { promise: Promise<Response>; resolve: (response: Response) => void } {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });
  return { promise, resolve };
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

  assert.equal(fetchCalls[0], "http://127.0.0.1:8000/v1/models");
  assert.equal(registered.length, 1);
  assert.equal(registered[0].name, "vllm-metal-27b");
  assert.equal(registered[0].config.baseUrl, "http://127.0.0.1:8000/v1");
  assert.equal(registered[0].config.api, "openai-completions");
  assert.equal(registered[0].config.apiKey, "vllm");
  assert.equal(registered[0].config.models[0].id, "Qwen/Qwen3.6-27B-FP8");
  assert.equal(registered[0].config.models[0].contextWindow, 196608);
  assert.deepEqual(registered[0].config.models[0].compat, {
    supportsDeveloperRole: false,
    supportsReasoningEffort: false,
    supportsUsageInStreaming: false,
    thinkingFormat: "qwen",
  });
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

test("discoverAndRegisterVllmMetalQwen36Providers probes URLs concurrently and registers in base URL order", async () => {
  const registered: Array<{ name: string; config: any }> = [];
  const first = deferredResponse();
  const second = deferredResponse();
  const fetchCalls: string[] = [];

  const discovery = discoverAndRegisterVllmMetalQwen36Providers({
    baseUrls: ["http://127.0.0.1:8000/v1", "http://127.0.0.1:8001/v1"],
    fetchImpl: async (url) => {
      fetchCalls.push(String(url));
      if (String(url).startsWith("http://127.0.0.1:8000")) return first.promise;
      return second.promise;
    },
    registerProvider: (name, config) => registered.push({ name, config }),
    timeoutMs: 50,
  });

  await Promise.resolve();
  assert.deepEqual(fetchCalls, [
    "http://127.0.0.1:8000/v1/models",
    "http://127.0.0.1:8001/v1/models",
  ]);

  second.resolve(jsonResponse({ data: [{ id: "Qwen/Qwen3.6-35B-A3B-FP8" }] }));
  await Promise.resolve();
  assert.equal(registered.length, 0);

  first.resolve(jsonResponse({ data: [{ id: "Qwen/Qwen3.6-27B-FP8" }] }));
  await discovery;

  assert.deepEqual(registered.map((entry) => entry.name), ["vllm-metal-27b", "vllm-metal-35b"]);
  assert.deepEqual(registered.map((entry) => entry.config.baseUrl), [
    "http://127.0.0.1:8000/v1",
    "http://127.0.0.1:8001/v1",
  ]);
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

test("discoverAndRegisterVllmMetalQwen36Providers unregisters stale managed providers", async () => {
  const registered: string[] = [];
  const unregistered: string[] = [];

  await discoverAndRegisterVllmMetalQwen36Providers({
    baseUrls: ["http://127.0.0.1:8000/v1", "http://127.0.0.1:8001/v1"],
    fetchImpl: async (url) => {
      if (String(url).startsWith("http://127.0.0.1:8000")) {
        return jsonResponse({ data: [{ id: "Qwen/Qwen3.6-27B-FP8" }] });
      }
      return jsonResponse({ data: [{ id: "Qwen/Qwen3.6-35B-A3B-FP8" }] });
    },
    registerProvider: (name) => registered.push(name),
    unregisterProvider: (name) => unregistered.push(name),
    timeoutMs: 5,
  });

  await discoverAndRegisterVllmMetalQwen36Providers({
    baseUrls: ["http://127.0.0.1:8000/v1", "http://127.0.0.1:8001/v1"],
    fetchImpl: async (url) => {
      if (String(url).startsWith("http://127.0.0.1:8000")) {
        return jsonResponse({ data: [{ id: "Qwen/Qwen3.6-27B-FP8" }] });
      }
      throw new Error("closed");
    },
    registerProvider: (name) => registered.push(name),
    unregisterProvider: (name) => unregistered.push(name),
    timeoutMs: 5,
  });

  assert.deepEqual(registered, ["vllm-metal-27b", "vllm-metal-35b", "vllm-metal-27b"]);
  assert.deepEqual(unregistered, ["vllm-metal-35b"]);
});

test("default URL list includes 8000 and 8001 localhost variants", () => {
  assert.deepEqual(DEFAULT_VLLM_METAL_BASE_URLS, [
    "http://127.0.0.1:8000/v1",
    "http://localhost:8000/v1",
    "http://127.0.0.1:8001/v1",
    "http://localhost:8001/v1",
  ]);
});
