# Provider Setup Guide

Step-by-step setup instructions for every LLM provider GWD supports. If you ran the onboarding wizard (`gwd config`) and picked a provider, you may already be configured — check with `/model` inside a session.

## Table of Contents

- [Quick Reference](#quick-reference)
- [Built-in Providers](#built-in-providers)
  - [Anthropic (Claude)](#anthropic-claude)
  - [OpenAI](#openai)
  - [Google Gemini](#google-gemini)
  - [OpenRouter](#openrouter)
  - [Groq](#groq)
  - [xAI (Grok)](#xai-grok)
  - [Mistral](#mistral)
  - [GitHub Copilot](#github-copilot)
  - [Amazon Bedrock](#amazon-bedrock)
  - [Anthropic on Vertex AI](#anthropic-on-vertex-ai)
  - [Azure OpenAI](#azure-openai)
- [Local Providers](#local-providers)
  - [Ollama](#ollama)
  - [LM Studio](#lm-studio)
  - [vLLM](#vllm)
  - [SGLang](#sglang)
- [Custom OpenAI-Compatible Endpoints](#custom-openai-compatible-endpoints)
- [Common Pitfalls](#common-pitfalls)
- [Verifying Your Setup](#verifying-your-setup)

## Quick Reference

| Provider | Auth Method | Env Variable | Config File |
|----------|-------------|-------------|-------------|
| Anthropic | API key | `ANTHROPIC_API_KEY` | — |
| OpenAI | API key | `OPENAI_API_KEY` | — |
| Google Gemini | API key | `GEMINI_API_KEY` | — |
| OpenRouter | API key | `OPENROUTER_API_KEY` | Optional `models.json` |
| Groq | API key | `GROQ_API_KEY` | — |
| xAI | API key | `XAI_API_KEY` | — |
| Mistral | API key | `MISTRAL_API_KEY` | — |
| GitHub Copilot | OAuth | `GH_TOKEN` | — |
| Amazon Bedrock | IAM credentials | `AWS_PROFILE` or `AWS_ACCESS_KEY_ID` | — |
| Vertex AI | ADC | `GOOGLE_APPLICATION_CREDENTIALS` | — |
| Azure OpenAI | API key | `AZURE_OPENAI_API_KEY` | — |
| Ollama | None (local) | — | `models.json` required |
| LM Studio | None (local) | — | `models.json` required |
| vLLM / SGLang | None (local) | — | `models.json` required |

---

## Built-in Providers

Built-in providers have models pre-registered in GWD. You only need to supply credentials.

### Anthropic (Claude)

**Recommended.** Anthropic models have the deepest integration: built-in web search, extended thinking, and prompt caching.

**Option A — API key (recommended):**

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Or run `gwd config` and paste your key when prompted.

**Get a key:** [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

**Option B — Claude Code CLI:**

If you have a Claude Pro or Max subscription, you can authenticate through Anthropic's official Claude Code CLI. Install it, sign in with `claude`, then GWD will detect and route through it automatically:

```bash
# Install Claude Code CLI (see https://docs.anthropic.com/en/docs/claude-code)
claude
# Sign in when prompted, then start GWD
gwd
```

GWD detects your local Claude Code installation and uses it as the authenticated Anthropic surface. This is the TOS-compliant path for subscription users — GWD never handles your subscription credentials directly.

> **Note:** GWD does not support browser-based OAuth sign-in for Anthropic. Use an API key or the Claude Code CLI instead.

**Option C — Use your Claude Pro/Max plan with GWD inside Claude Code:**

If you already have a Claude Pro or Max subscription and want to use GWD's planning, execution, and milestone orchestration directly from Claude Code — without switching to a separate terminal — you can connect GWD as an MCP server. This gives Claude Code access to GWD's full workflow toolset via the [Model Context Protocol](https://modelcontextprotocol.io), so you get GWD's structured project management powered by your existing Claude plan.

**Automatic setup (recommended):**

When GWD detects a Claude Code model during startup, it automatically writes a `.mcp.json` file in your project root with the GWD workflow MCP server configured. No manual steps needed — just start GWD once with Claude Code as the provider and the config is created for you.

You can also trigger this manually from inside a GWD session:

```bash
/gwd mcp init
```

This writes (or updates) the `gwd-workflow` entry in your project's `.mcp.json`. Claude Code discovers this file automatically on its next session start.

**Manual setup:**

If you prefer to configure it yourself, add GWD to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "gwd": {
      "command": "npx",
      "args": ["gwd-mcp-server"],
      "env": {
        "GWD_CLI_PATH": "/path/to/gwd"
      }
    }
  }
}
```

Or if `gwd-mcp-server` is installed globally:

```json
{
  "mcpServers": {
    "gwd": {
      "command": "gwd-mcp-server"
    }
  }
}
```

You can also add this to `~/.claude/settings.json` under `mcpServers` to make GWD available across all projects.

**What's exposed:**

The MCP server provides GWD's full workflow tool surface — milestone planning, task completion, slice management, roadmap reassessment, journal queries, and more. Session management tools (`gwd_execute`, `gwd_status`, `gwd_result`, `gwd_cancel`) let Claude Code start and monitor GWD auto-mode sessions. See [Commands → MCP Server Mode](./commands.md#mcp-server-mode) for the full tool list.

**Verify the connection:**

From inside a GWD session, check that the MCP server is reachable:

```bash
/gwd mcp status
```

### OpenAI

```bash
export OPENAI_API_KEY="sk-..."
```

Or run `gwd config` and choose "Paste an API key" then "OpenAI".

**Get a key:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### Google Gemini

```bash
export GEMINI_API_KEY="..."
```

**Get a key:** [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### OpenRouter

OpenRouter aggregates 200+ models from multiple providers behind a single API key.

**Step 1 — Get your API key:**

Go to [openrouter.ai/keys](https://openrouter.ai/keys) and create a key.

**Step 2 — Set the key:**

```bash
export OPENROUTER_API_KEY="sk-or-..."
```

Or run `gwd config`, choose "Paste an API key", then "OpenRouter".

**Step 3 — Switch to an OpenRouter model:**

Inside a GWD session, type `/model` and select an OpenRouter model. Models are prefixed with `openrouter/` (e.g., `openrouter/anthropic/claude-sonnet-4`).

**Optional — Add custom OpenRouter models via `models.json`:**

If you want models not in the built-in list, add them to `~/.gwd/agent/models.json`:

```json
{
  "providers": {
    "openrouter": {
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "OPENROUTER_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "meta-llama/llama-3.3-70b",
          "name": "Llama 3.3 70B (OpenRouter)",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 131072,
          "maxTokens": 32768,
          "cost": { "input": 0.3, "output": 0.3, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
```

Note: the `apiKey` field here is the *name* of the environment variable, not the literal key. GWD resolves it automatically. You can also use a literal value or a shell command (see [Value Resolution](./custom-models.md#value-resolution)).

**Optional — Route through specific providers:**

Use `modelOverrides` to control which upstream provider OpenRouter uses:

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

### Groq

```bash
export GROQ_API_KEY="gsk_..."
```

**Get a key:** [console.groq.com/keys](https://console.groq.com/keys)

### xAI (Grok)

```bash
export XAI_API_KEY="xai-..."
```

**Get a key:** [console.x.ai](https://console.x.ai)

### Mistral

```bash
export MISTRAL_API_KEY="..."
```

**Get a key:** [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys)

### GitHub Copilot

Uses OAuth — sign in through the browser:

```bash
gwd config
# Choose "Sign in with your browser" → "GitHub Copilot"
```

Requires an active GitHub Copilot subscription.

### Amazon Bedrock

Bedrock uses AWS IAM credentials, not API keys. Any of these work:

```bash
# Option 1: Named profile
export AWS_PROFILE="my-profile"

# Option 2: IAM keys
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="us-east-1"

# Option 3: Bedrock API key (bearer token)
export AWS_BEARER_TOKEN_BEDROCK="..."
```

ECS task roles and IRSA (Kubernetes) are also detected automatically.

### Anthropic on Vertex AI

Uses Google Cloud Application Default Credentials:

```bash
gcloud auth application-default login
export ANTHROPIC_VERTEX_PROJECT_ID="my-project-id"
```

Or set `GOOGLE_CLOUD_PROJECT` and ensure ADC credentials exist at `~/.config/gcloud/application_default_credentials.json`.

### Azure OpenAI

```bash
export AZURE_OPENAI_API_KEY="..."
```

---

## Local Providers

Local providers run on your machine. They require a `models.json` configuration file because GWD needs to know the endpoint URL and which models are available.

**Config file location:** `~/.gwd/agent/models.json`

The file reloads each time you open `/model` — no restart needed.

### Ollama

**Step 1 — Install and start Ollama:**

```bash
# macOS
brew install ollama
ollama serve

# Or download from https://ollama.com
```

**Step 2 — Pull a model:**

```bash
ollama pull llama3.1:8b
ollama pull qwen2.5-coder:7b
```

**Step 3 — Create `~/.gwd/agent/models.json`:**

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false
      },
      "models": [
        { "id": "llama3.1:8b" },
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

The `apiKey` is required by the config schema but Ollama ignores it — any value works.

**Step 4 — Select the model:**

Inside GWD, type `/model` and pick your Ollama model.

**Ollama tips:**
- Ollama does not support the `developer` role or `reasoning_effort` — always set `compat.supportsDeveloperRole: false` and `compat.supportsReasoningEffort: false`.
- If you get empty responses, check that `ollama serve` is running and the model is pulled.
- Context window and max tokens default to 128K / 16K if not specified. Override these if your model has different limits.

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

### LM Studio

**Step 1 — Install LM Studio:**

Download from [lmstudio.ai](https://lmstudio.ai).

**Step 2 — Start the local server:**

In LM Studio, go to the "Local Server" tab, load a model, and click "Start Server". The default port is 1234.

**Step 3 — Create `~/.gwd/agent/models.json`:**

```json
{
  "providers": {
    "lm-studio": {
      "baseUrl": "http://localhost:1234/v1",
      "api": "openai-completions",
      "apiKey": "lm-studio",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false
      },
      "models": [
        {
          "id": "your-model-name",
          "name": "My Local Model",
          "contextWindow": 32768,
          "maxTokens": 4096
        }
      ]
    }
  }
}
```

Replace `your-model-name` with the model identifier shown in LM Studio's server tab.

**LM Studio tips:**
- The model ID in `models.json` must match what LM Studio reports in its server API. Check the server tab for the exact string.
- LM Studio defaults to port 1234. If you changed it, update `baseUrl` accordingly.
- Increase `contextWindow` and `maxTokens` if your model supports larger contexts.

### vLLM

```json
{
  "providers": {
    "vllm": {
      "baseUrl": "http://localhost:8000/v1",
      "api": "openai-completions",
      "apiKey": "vllm",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false,
        "supportsUsageInStreaming": false
      },
      "models": [
        {
          "id": "meta-llama/Llama-3.1-8B-Instruct",
          "contextWindow": 128000,
          "maxTokens": 16384
        }
      ]
    }
  }
}
```

The model `id` must match the `--model` flag you passed to `vllm serve`.

#### Apple Silicon vLLM Metal TurboQuant Qwen3.6 Profile

On a 48GB Apple Silicon machine, GWD auto-mode can detect a local `vllm-metal` server running Qwen3.6 with TurboQuant KV cache compression. GWD does not start `vllm-metal` and does not enable TurboQuant per request; TurboQuant is part of the server startup command.

From a source checkout, print the recommended startup commands and optional `models.json` shape with:

```bash
npm run setup:vllm-metal-qwen36 -- --model both --models-json
```

See [the helper README](../../scripts/README-vllm-metal-qwen36-turboquant.md) for custom ports, lower context targets, and `--start` usage.

Start the default 27B executor on port `8000`:

```bash
VLLM_METAL_USE_PAGED_ATTENTION=1 vllm serve Qwen/Qwen3.6-27B-FP8 \
  --host 127.0.0.1 \
  --port 8000 \
  --max-model-len 196608 \
  --reasoning-parser qwen3 \
  --additional-config '{"turboquant": true, "k_quant": "q8_0", "v_quant": "q3_0"}'
```

When GWD sees `Qwen/Qwen3.6-27B*` on `http://127.0.0.1:8000/v1` or `http://localhost:8000/v1`, auto-mode applies a 196608-token effective context target and uses 27B for light, standard, and heavy work.

An optional separate 35B-A3B endpoint can be used only for heavy phases:

```bash
VLLM_METAL_USE_PAGED_ATTENTION=1 vllm serve Qwen/Qwen3.6-35B-A3B-FP8 \
  --host 127.0.0.1 \
  --port 8001 \
  --max-model-len 196608 \
  --reasoning-parser qwen3 \
  --additional-config '{"turboquant": true, "k_quant": "q8_0", "v_quant": "q3_0"}'
```

Running both endpoints at the same time is supported, but the default recommendation for a 48GB machine is to run only the 27B endpoint. If the 35B-A3B endpoint hits a local resource or model-load failure, GWD suppresses it for the current auto run and retries the interrupted unit on 27B.

GWD automatically probes these local OpenAI-compatible base URLs:

- `http://127.0.0.1:8000/v1`
- `http://localhost:8000/v1`
- `http://127.0.0.1:8001/v1`
- `http://localhost:8001/v1`

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
        "thinkingFormat": "qwen"
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

Keep `contextWindow` aligned with the server's `--max-model-len`. If you start `vllm-metal` with a lower context because of memory pressure, either lower the model entry or set a project override:

```md
---
context_window_override: 131072
---
```

### SGLang

```json
{
  "providers": {
    "sglang": {
      "baseUrl": "http://localhost:30000/v1",
      "api": "openai-completions",
      "apiKey": "sglang",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false
      },
      "models": [
        {
          "id": "meta-llama/Llama-3.1-8B-Instruct"
        }
      ]
    }
  }
}
```

---

## Custom OpenAI-Compatible Endpoints

Any server that implements the OpenAI Chat Completions API can work with GWD. This covers proxies (LiteLLM, Portkey, Helicone), self-hosted inference, and new providers.

**Quickest path — use the onboarding wizard:**

```bash
gwd config
# Choose "Paste an API key" → "Custom (OpenAI-compatible)"
# Enter: base URL, API key, model ID
```

This writes `~/.gwd/agent/models.json` for you automatically.

**Manual setup:**

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
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
```

**Adding custom headers (for proxies):**

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

**Qwen models with thinking mode:**

For Qwen-compatible servers, use `thinkingFormat` to enable thinking mode:

```json
{
  "compat": {
    "thinkingFormat": "qwen",
    "supportsDeveloperRole": false
  }
}
```

GWD currently supports top-level `enable_thinking` for Qwen-compatible servers through `"qwen"`.

For the full reference on `compat` fields, `modelOverrides`, value resolution, and advanced configuration, see [Custom Models](./custom-models.md).

---

## Common Pitfalls

### "Authentication failed" with a valid key

**Cause:** The key is set in your shell but not visible to GWD.

**Fix:** Make sure the environment variable is exported in the same terminal where you run `gwd`. Or use `gwd config` to save the key to `~/.gwd/agent/auth.json` so it persists across sessions.

### OpenRouter models not appearing in `/model`

**Cause:** No `OPENROUTER_API_KEY` set, so GWD hides OpenRouter models.

**Fix:** Set the key and restart GWD:

```bash
export OPENROUTER_API_KEY="sk-or-..."
gwd
```

### Ollama returns empty responses

**Cause:** Ollama server isn't running, or the model isn't pulled.

**Fix:**

```bash
# Verify the server is running
curl http://localhost:11434/v1/models

# Pull the model if missing
ollama pull llama3.1:8b
```

### LM Studio model ID mismatch

**Cause:** The `id` in `models.json` doesn't match what LM Studio exposes via its API.

**Fix:** Check the LM Studio server tab for the exact model identifier. It often includes the filename or quantization level (e.g., `lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF`).

### `developer` role error with local models

**Cause:** Most local inference servers don't support the OpenAI `developer` message role.

**Fix:** Add `compat.supportsDeveloperRole: false` to the provider config. This makes GWD send `system` messages instead:

```json
{
  "compat": {
    "supportsDeveloperRole": false,
    "supportsReasoningEffort": false
  }
}
```

### `stream_options` error with local models

**Cause:** Some servers don't support `stream_options: { include_usage: true }`.

**Fix:** Add `compat.supportsUsageInStreaming: false`:

```json
{
  "compat": {
    "supportsUsageInStreaming": false
  }
}
```

### "apiKey is required" validation error

**Cause:** `models.json` schema requires `apiKey` when `models` are defined.

**Fix:** For local servers that don't need auth, set a dummy value:

```json
"apiKey": "not-needed"
```

### Cost shows $0.00 for custom models

**Expected behavior.** GWD defaults cost to zero for custom models. Override with the `cost` field if you want accurate cost tracking:

```json
"cost": { "input": 0.15, "output": 0.60, "cacheRead": 0.015, "cacheWrite": 0.19 }
```

Values are per million tokens.

---

## Verifying Your Setup

After configuring a provider:

1. **Launch GWD:**
   ```bash
   gwd
   ```

2. **Check available models:**
   ```
   /model
   ```
   Your provider's models should appear in the list.

3. **Switch to the model:**
   Select it from the `/model` picker.

4. **Send a test message:**
   Type anything to confirm the model responds.

If the model doesn't appear, check:
- The environment variable is set in the current shell
- `models.json` is valid JSON (use `cat ~/.gwd/agent/models.json | python3 -m json.tool`)
- The server is running (for local providers)

For additional help, see [Troubleshooting](./troubleshooting.md) or run `/gwd doctor` inside a session.
