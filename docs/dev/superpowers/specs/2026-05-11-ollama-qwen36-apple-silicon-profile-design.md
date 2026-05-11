# Ollama Qwen3.6 Apple Silicon Profile Design

## Summary

Add an Ollama-only Apple Silicon safety profile for local Qwen3.6 coding models on 48GB Macs. The profile uses Ollama's MLX NVFP4 tags, keeps the effective context at 64K tokens, routes ordinary auto-mode work to the 27B model, and reserves the 35B-A3B model for bounded heavy phases.

The feature is intentionally conservative. It optimizes for avoiding local memory exhaustion, not for maximizing advertised model context.

## Goals

- Prefer Apple Silicon optimized Ollama tags:
  - `qwen3.6:27b-coding-nvfp4`
  - `qwen3.6:35b-a3b-coding-nvfp4`
- Register those exact tags with a 64K effective context by default.
- Avoid the broad `qwen3.6` Ollama capability entry from applying a very large `num_ctx` to these local MLX tags.
- Use 27B for light and standard work.
- Use 35B-A3B only for heavy planning, replanning, and other high-reasoning units.
- Fall back from 35B-A3B to 27B when the heavy model is unavailable or hits local memory/context failures.
- Preserve explicit user control through `context_window_override`, explicit `models`, and explicit `dynamic_routing`.

## Non-Goals

- No generic LM Studio, vLLM, SGLang, or OpenAI-compatible provider policy in this first version.
- No automatic hardware probing or live memory estimation.
- No default use of BF16 Qwen3.6 Ollama tags.
- No default use of larger 35B-A3B quantizations such as MXFP8.
- No claim that a 64K context can hold a large repository in prompt context.
- No automatic model pull. Missing models should be reported; users remain responsible for installing them.

## Research Basis

Ollama documents that larger context windows increase memory usage and that `keep_alive` can be set to `0` to unload a model immediately after use. Ollama's Qwen3.6 library page lists MLX NVFP4 tags for Apple Silicon and larger BF16/MXFP8 variants that are poor defaults for a 48GB safety profile.

GWD already has context-window-aware prompt budgets, task-count ceilings, dynamic model routing, and Ollama model discovery. The design should reuse those surfaces instead of adding a second context management system.

References:

- Ollama Qwen3.6 library: https://ollama.com/library/qwen3.6
- Ollama context length docs: https://docs.ollama.com/context-length
- Ollama chat API `keep_alive`: https://docs.ollama.com/api/chat
- Qwen3.6-27B model card: https://huggingface.co/Qwen/Qwen3.6-27B
- Qwen3.6-35B-A3B model card: https://huggingface.co/Qwen/Qwen3.6-35B-A3B

## Architecture

### Ollama Exact Tag Capabilities

The Ollama capability table should distinguish exact model tags from broad model families. Current family matching strips the tag after `:`, which makes `qwen3.6:27b-coding-nvfp4` and `qwen3.6:35b-a3b-coding-nvfp4` fall through to the broad `qwen3.6` entry. That broad entry is unsafe for this local profile because it can advertise a very large `num_ctx`.

Add exact-tag capability matching before family-prefix matching. The exact entries should be:

| Model ID | Context window | Max tokens | Provider options |
| --- | ---: | ---: | --- |
| `qwen3.6:27b-coding-nvfp4` | 65536 | 16384 | `{ num_ctx: 65536, keep_alive: "0" }` |
| `qwen3.6:35b-a3b-coding-nvfp4` | 65536 | 16384 | `{ num_ctx: 65536, keep_alive: "0" }` |

`keep_alive: "0"` is a deliberate safety trade-off. It increases cold-load latency, but it prevents Ollama from keeping both 27B and 35B resident while auto-mode switches tiers.

### Auto-Mode Preset

Add an Ollama Apple Silicon preset resolver in the GWD auto-mode model selection path. The resolver should activate only when all of these are true:

- Auto-mode is dispatching work.
- The active provider or start model provider is `ollama`.
- The available model registry contains `ollama/qwen3.6:27b-coding-nvfp4`.
- The user has not configured explicit per-phase `models`.
- The user has not configured an explicit `dynamic_routing` block.

If the 35B-A3B tag is also available, the synthesized tier map is:

```yaml
dynamic_routing:
  enabled: true
  cross_provider: false
  capability_routing: false
  tier_models:
    light: ollama/qwen3.6:27b-coding-nvfp4
    standard: ollama/qwen3.6:27b-coding-nvfp4
    heavy: ollama/qwen3.6:35b-a3b-coding-nvfp4
```

If the 35B-A3B tag is missing, the preset should still run safely with 27B for all tiers and notify the user that heavy work is using the 27B fallback.

### Context Budgeting

The exact Ollama tag metadata is the primary mechanism for context safety. Once the two MLX NVFP4 tags register as 64K models, existing prompt budget code automatically reduces:

- inline context budget
- summary budget
- verification budget
- planner task-count ceiling
- continue-here threshold calculations

`context_window_override` remains authoritative. If the user sets it to 128K or another value, GWD should use the override for prompt budgeting. This is an explicit opt-in to higher memory risk.

### Large Repository Behavior

A 64K context should be described as a safe execution envelope, not a large-repository-in-context promise. Large repositories should be handled through existing decomposition behavior:

- smaller slices
- fewer tasks per slice
- targeted file reads
- compact dependency summaries
- codebase maps and memory queries
- verification output truncation

When prompt builders shrink context because of the 64K window, planner instructions should continue to push explicit paths, bounded task inputs, and aggressive decomposition.

## Data Flow

1. Ollama extension probes `/api/tags`.
2. Discovered model names are passed to exact-tag capability matching.
3. The two MLX NVFP4 Qwen3.6 tags register with `contextWindow: 65536`, `maxTokens: 16384`, and safe Ollama provider options.
4. Auto-mode bootstrap captures the Ollama start model.
5. Model selection sees no explicit user model routing and synthesizes the Apple Silicon preset.
6. Light and standard units dispatch to 27B.
7. Heavy units dispatch to 35B-A3B when present.
8. If 35B-A3B is missing or suppressed after failure, heavy units dispatch to 27B.
9. Prompt builders and timers use the 64K effective context through existing context-budget APIs.

## Error Handling

The feature should classify local Ollama resource failures separately from account entitlement failures. Candidate error text includes out-of-memory, failed allocation, model load failure, llama runner termination, context overflow, and server-side 500 responses from Ollama while loading or evaluating a model.

On a 35B-A3B local resource failure:

- retry the unit with `ollama/qwen3.6:27b-coding-nvfp4`
- suppress 35B-A3B for the rest of the current auto-mode run
- notify the user that heavy work is continuing on 27B because the 35B model exceeded local runtime limits

The suppression should be session-scoped, not a persistent account block. Ollama resource failures depend on machine load, quantization, context size, and currently loaded models.

On a missing model:

- continue with 27B if the 27B tag is available
- notify the user to pull `qwen3.6:35b-a3b-coding-nvfp4` for heavy-tier routing

On missing 27B:

- do not activate the preset
- leave normal Ollama model selection behavior unchanged

## Testing

Focused coverage should include:

- Exact-tag capability matching checks the full Ollama model ID before stripping the tag.
- `qwen3.6:27b-coding-nvfp4` registers with 64K context, 16K max tokens, `num_ctx: 65536`, and `keep_alive: "0"`.
- `qwen3.6:35b-a3b-coding-nvfp4` registers with the same safety options.
- Broad `qwen3.6` models still use the existing family capability behavior.
- The Apple Silicon preset is synthesized only for Ollama.
- Explicit `models` preferences disable preset synthesis.
- Any explicit `dynamic_routing` preference block disables preset synthesis.
- 27B is selected for light and standard units.
- 35B-A3B is selected for heavy units when present.
- Missing 35B-A3B falls back to 27B and emits a visible notification.
- 35B-A3B local resource failure suppresses 35B for the current run and retries on 27B.
- `context_window_override` still wins over the 64K default for prompt budgeting.
- Prompt budget and task-count tests reflect 64K behavior for the exact tags.

## Acceptance Criteria

- A user with Ollama running and both MLX NVFP4 Qwen3.6 tags installed gets safe automatic tier routing in auto-mode without editing `models.json`.
- The 27B model handles light and standard work.
- The 35B-A3B model handles only heavy work.
- The effective default context for both exact tags is 64K tokens.
- The profile does not select BF16 or MXFP8 tags by default.
- The profile does not affect LM Studio, vLLM, SGLang, or generic OpenAI-compatible providers.
- Explicit user preferences override the preset.
- Local 35B memory/context failures fall back to 27B without repeatedly retrying 35B in the same run.
