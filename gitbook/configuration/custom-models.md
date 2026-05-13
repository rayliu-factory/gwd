# Custom Models

Define custom models and providers in `~/.gwd/agent/models.json`. This lets you add models not in the default registry — self-hosted endpoints, fine-tuned models, proxies, or new provider releases.

## File Location

GWD looks for models.json at:
1. `~/.gwd/agent/models.json` (primary)
2. `~/.pi/agent/models.json` (fallback)

The file reloads each time you open `/model` — no restart needed.

## Basic Structure

```json
{
  "providers": {
    "my-provider": {
      "baseUrl": "https://my-endpoint.example.com/v1",
      "apiKey": "MY_PROVIDER_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "model-id-here",
          "name": "Friendly Model Name",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 16384,
          "cost": { "input": 0.15, "output": 0.60, "cacheRead": 0.015, "cacheWrite": 0.19 }
        }
      ]
    }
  }
}
```

## API Key Resolution

The `apiKey` field can be:

- **An environment variable name**: `"OPENROUTER_API_KEY"` — GWD resolves it automatically
- **A literal value**: `"sk-abc123..."` — used directly
- **A dummy value**: `"not-needed"` — for local servers that don't require auth

## Compatibility Flags

Local and non-standard servers often need compatibility adjustments:

```json
{
  "compat": {
    "supportsDeveloperRole": false,
    "supportsReasoningEffort": false,
    "supportsUsageInStreaming": false,
    "thinkingFormat": "qwen"
  }
}
```

| Flag | Default | Purpose |
|------|---------|---------|
| `supportsDeveloperRole` | `true` | Set `false` if the server doesn't support the `developer` message role |
| `supportsReasoningEffort` | `true` | Set `false` if the server doesn't support reasoning effort parameters |
| `supportsUsageInStreaming` | `true` | Set `false` if streaming responses don't include token usage |
| `thinkingFormat` | — | Set `"qwen"` for Qwen thinking mode |

## vLLM Metal Qwen3.6 TurboQuant on Apple Silicon

For the default 48GB Apple Silicon profile, start `vllm-metal` on port `8000` and GWD will auto-detect `Qwen/Qwen3.6-27B*`:

The helper can print this command plus the optional 35B-A3B setup:

```bash
gwd setup vllm-metal-qwen36 --model both --models-json
```

See [the helper README](../../scripts/README-vllm-metal-qwen36-turboquant.md) for custom ports, lower context targets, and `--start` usage.

```bash
VLLM_METAL_USE_PAGED_ATTENTION=1 vllm serve Qwen/Qwen3.6-27B-FP8 \
  --host 127.0.0.1 \
  --port 8000 \
  --max-model-len 196608 \
  --reasoning-parser qwen3 \
  --additional-config '{"turboquant": true, "k_quant": "q8_0", "v_quant": "q3_0"}'
```

GWD uses the 27B endpoint as the default executor. If you run a separate 35B-A3B endpoint, auto-mode routes only heavy phases to it and falls back to 27B after local resource or model-load failures.

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
        "thinkingFormat": "qwen"
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
        "thinkingFormat": "qwen"
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
        "thinkingFormat": "qwen"
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

GWD does not start `vllm-metal` for you. TurboQuant must be enabled when you launch the server. Keep `contextWindow` aligned with the server's `--max-model-len`, or override it per project:

```md
---
context_window_override: 131072
---
```

## Custom Headers

For proxies that need extra headers:

```json
{
  "providers": {
    "litellm-proxy": {
      "baseUrl": "https://litellm.example.com/v1",
      "apiKey": "MY_API_KEY",
      "api": "openai-completions",
      "headers": {
        "x-custom-header": "value"
      },
      "models": [...]
    }
  }
}
```

## Model Overrides

Override specific model settings without redefining the entire model:

```json
{
  "providers": {
    "openrouter": {
      "modelOverrides": {
        "anthropic/claude-sonnet-4": {
          "compat": {
            "openRouterRouting": {
              "only": ["amazon-bedrock"]
            }
          }
        }
      }
    }
  }
}
```

## Cost Tracking

For accurate cost tracking with custom models, add the `cost` field (per million tokens):

```json
"cost": {
  "input": 0.15,
  "output": 0.60,
  "cacheRead": 0.015,
  "cacheWrite": 0.19
}
```

Without this, cost shows $0.00 — which is the expected default for custom models.

## Community Extensions

For providers not built into GWD, community extensions add full provider support:

| Extension | Provider | Install |
|-----------|----------|---------|
| `pi-dashscope` | Alibaba DashScope (Qwen3, GLM-5, etc.) | `gwd install npm:pi-dashscope` |
