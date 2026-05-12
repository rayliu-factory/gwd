# vLLM Metal TurboQuant Qwen3.6 Profile Design

## Summary

Add a synthesized GWD auto-mode profile for a 48GB Apple Silicon machine running Qwen3.6 through `vllm-metal` with TurboQuant KV-cache compression. The profile auto-detects a local OpenAI-compatible `vllm-metal` endpoint, treats `Qwen/Qwen3.6-27B*` as the default executor, uses a 192K effective context target, and optionally routes heavy phases to `Qwen/Qwen3.6-35B-A3B*` only when a separate local 35B endpoint is explicitly configured and available.

GWD does not implement TurboQuant and does not pass TurboQuant settings per request. TurboQuant remains an inference-server startup concern.

## Goals

- Automatically recognize a local OpenAI-compatible `vllm-metal` endpoint serving Qwen3.6.
- Use `Qwen/Qwen3.6-27B*` as the default model for light, standard, and fallback heavy work.
- Apply a 192K effective context target (`196608` tokens) for GWD prompt budgeting and model metadata unless the user sets `context_window_override`.
- Route heavy auto-mode phases to `Qwen/Qwen3.6-35B-A3B*` only when a second local endpoint is configured and available.
- Fall back from 35B-A3B to 27B for clear local resource or model-load failures.
- Keep user control authoritative through explicit `models`, `dynamic_routing`, and `context_window_override` preferences.
- Document the required `vllm-metal` TurboQuant startup flags and the GWD `models.json` configuration shape.

## Non-Goals

- No GWD implementation of KV-cache compression.
- No automatic installation or startup of `vllm-metal`.
- No default two-server launch on 48GB Apple Silicon.
- No process lifecycle manager that stops 27B, starts 35B for heavy phases, then returns to 27B.
- No generic policy for every vLLM, SGLang, Ollama, LM Studio, or remote OpenAI-compatible provider.
- No claim that 192K is guaranteed to fit every machine state or every repository prompt.
- No automatic promotion to the full Qwen3.6 native 262K context.
- No persistent rewrite of the user's `models.json` from passive discovery.

## Research Basis

`vllm-metal` documents TurboQuant KV-cache compression for Apple Silicon, controlled by vLLM's `--additional-config` JSON and requiring `VLLM_METAL_USE_PAGED_ATTENTION=1`. Its default `q8_0` key and `q3_0` value configuration is documented as a conservative quality-oriented setting with roughly 2.56x KV-cache compression against fp16 in the published example.

The `vllm-metal` supported-model matrix lists Qwen3.6 as supported on Apple Silicon, verified on `Qwen/Qwen3.6-35B-A3B-FP8`. It also notes that Qwen3.6 uses a hybrid SDPA plus GDN linear architecture; only layers with paged KV cache benefit from TurboQuant compression.

Qwen's FP8 model cards for `Qwen/Qwen3.6-27B-FP8` and `Qwen/Qwen3.6-35B-A3B-FP8` both advertise a native 262,144-token context and compatibility with vLLM and SGLang. This design deliberately starts below that at 192K for a 48GB local machine.

References:

- vLLM Metal TurboQuant docs: https://docs.vllm.ai/projects/vllm-metal/en/latest/turboquant/
- vLLM Metal supported models: https://docs.vllm.ai/projects/vllm-metal/en/latest/supported_models/
- Qwen3.6-27B-FP8 model card: https://huggingface.co/Qwen/Qwen3.6-27B-FP8
- Qwen3.6-35B-A3B-FP8 model card: https://huggingface.co/Qwen/Qwen3.6-35B-A3B-FP8
- Qwen3.6-35B-A3B vLLM recipe: https://recipes.vllm.ai/Qwen/Qwen3.6-35B-A3B

## Architecture

### Runtime Boundary

GWD treats `vllm-metal` as an external OpenAI-compatible runtime. GWD's responsibilities are:

- detect eligible local endpoints and model IDs
- synthesize GWD routing and context metadata
- budget prompts around the effective context target
- recover from known local resource failures
- document how to start the runtime correctly

`vllm-metal` remains responsible for:

- loading model weights
- enabling paged attention
- enabling TurboQuant
- choosing key/value quantization settings
- enforcing the actual model length at runtime

The recommended startup profile for the default 27B endpoint is:

```bash
VLLM_METAL_USE_PAGED_ATTENTION=1 vllm serve Qwen/Qwen3.6-27B-FP8 \
  --host 127.0.0.1 \
  --port 8000 \
  --max-model-len 196608 \
  --reasoning-parser qwen3 \
  --additional-config '{"turboquant": true, "k_quant": "q8_0", "v_quant": "q3_0"}'
```

The optional heavy endpoint, when the user chooses to run it separately, is:

```bash
VLLM_METAL_USE_PAGED_ATTENTION=1 vllm serve Qwen/Qwen3.6-35B-A3B-FP8 \
  --host 127.0.0.1 \
  --port 8001 \
  --max-model-len 196608 \
  --reasoning-parser qwen3 \
  --additional-config '{"turboquant": true, "k_quant": "q8_0", "v_quant": "q3_0"}'
```

The two-server setup is supported by the profile but is not the default recommendation for a 48GB machine. The default recommendation is one 27B server.

### Activation Rules

The synthesized profile activates only when all of these are true:

- Auto-mode is dispatching work.
- GWD sees an available local OpenAI-compatible endpoint with a localhost-style base URL, either from passive localhost probing or from `models.json`.
- At least one available model ID matches `Qwen/Qwen3.6-27B*`.
- The provider API is OpenAI-compatible.
- The user has not configured explicit per-phase `models`.
- The user has not configured explicit `dynamic_routing`.

The profile does not activate for remote endpoints, even if the model IDs match. Remote Qwen providers may have different billing, capacity, context, safety, and failure behavior.

### Model Matching

The detector should match these families case-sensitively at first, with narrow wildcard handling for quantization suffixes:

| Role | Model ID pattern |
| --- | --- |
| Default executor | `Qwen/Qwen3.6-27B*` |
| Heavy executor | `Qwen/Qwen3.6-35B-A3B*` |

Known exact IDs include:

- `Qwen/Qwen3.6-27B-FP8`
- `Qwen/Qwen3.6-35B-A3B-FP8`

The detector should not match unrelated Qwen3, Qwen3.5, Qwen Coder, or Ollama tag names.

### Routing

When only the 27B endpoint is available, the synthesized routing is:

```yaml
dynamic_routing:
  enabled: true
  cross_provider: false
  capability_routing: false
  tier_models:
    light: vllm-metal-27b/Qwen/Qwen3.6-27B-FP8
    standard: vllm-metal-27b/Qwen/Qwen3.6-27B-FP8
    heavy: vllm-metal-27b/Qwen/Qwen3.6-27B-FP8
```

When both a 27B endpoint and a separate local 35B-A3B endpoint are configured and available, the synthesized routing is:

```yaml
dynamic_routing:
  enabled: true
  cross_provider: false
  capability_routing: false
  tier_models:
    light: vllm-metal-27b/Qwen/Qwen3.6-27B-FP8
    standard: vllm-metal-27b/Qwen/Qwen3.6-27B-FP8
    heavy: vllm-metal-35b/Qwen/Qwen3.6-35B-A3B-FP8
```

The concrete provider IDs are user-configurable through `models.json`; the table above is illustrative.

### Context Target

The profile default is `196608` tokens. This is the approved practical stretch target for a 48GB Apple Silicon machine using TurboQuant, not a guaranteed hardware capacity and not the Qwen model maximum.

Precedence:

1. `context_window_override` wins when set.
2. The `vllm-metal` TurboQuant profile applies `196608`.
3. The model registry's configured `contextWindow` applies if the profile does not activate.
4. Existing GWD defaults apply if no model-specific context can be resolved.

GWD should patch the selected model's `contextWindow` for prompt budgeting and status display. It should not attempt to send a per-request max context setting to vLLM.

## Components

### vLLM Metal Qwen3.6 Profile Module

Add a profile module parallel to the existing Ollama Apple Silicon profile. It should own:

- model ID constants and matchers
- local endpoint checks
- synthesized routing construction
- context target application
- run-scoped 35B suppression
- resource-failure classification

### Local Endpoint Detection

Detection should use two sources, in order:

1. Passive probes of default local vLLM-compatible URLs:
   - `http://127.0.0.1:8000/v1`
   - `http://localhost:8000/v1`
   - `http://127.0.0.1:8001/v1`
   - `http://localhost:8001/v1`
2. The existing model registry, so users can configure custom ports, provider IDs, headers, or two explicit endpoints in `~/.gwd/agent/models.json`.

The passive probe should be a short-timeout `GET /models` request against the `/v1` base URL. If an eligible model is found, GWD can register a session-local provider entry with a dummy local API key and OpenAI-compatible API settings. It must not persist that provider unless the user explicitly runs a config command.

A model is eligible when:

- `baseUrl` is a local URL such as `http://localhost:*`, `http://127.0.0.1:*`, or `http://[::1]:*`
- `api` is OpenAI-compatible
- the model ID matches the Qwen3.6 27B or 35B-A3B patterns

If passive probing fails, GWD should continue normally. Failed probes should not produce startup noise unless the user enables verbose provider diagnostics.

### Context Helper

The helper should apply the effective context target to model metadata during selection and recovery. It should respect explicit `context_window_override` and keep one shared helper for normal dispatch, pinned-start reapply paths, and fallback recovery.

### Recovery Hook

The recovery path should recognize resource failures from the 35B-A3B endpoint and retry the unit with 27B when 27B is available. Suppression is run-scoped and clears at auto-mode start/stop.

### Documentation

Add user docs under provider setup or custom models that include:

- install/start assumptions for `vllm-metal`
- the 27B startup command
- the optional 35B-A3B startup command
- automatic default-port discovery behavior
- `~/.gwd/agent/models.json` examples for custom ports and two endpoints
- `.gwd/PREFERENCES.md` override guidance
- warnings that TurboQuant is a runtime startup option, not a GWD request option

## Data Flow

1. User starts `vllm-metal` with paged attention and TurboQuant.
2. GWD probes default local vLLM-compatible ports and loads any configured local providers from `models.json`.
3. GWD registers eligible discovered endpoints as session-local provider entries.
4. Auto-mode starts and captures the start model/provider.
5. Model selection asks the vLLM Metal Qwen3.6 profile resolver whether it applies.
6. The resolver finds a local 27B model and, optionally, a separate local 35B-A3B model.
7. The resolver synthesizes routing unless explicit user routing already exists.
8. The selected model is patched to the effective 192K context target, unless `context_window_override` is set.
9. Prompt budgeting uses the same effective context window.
10. Light and standard units dispatch to 27B.
11. Heavy units dispatch to 35B-A3B only when the separate endpoint is configured or discovered and not suppressed; otherwise they dispatch to 27B.
12. Resource failure from 35B-A3B suppresses 35B-A3B for the current run and retries on 27B.

## Error Handling And Safety

The profile fails open to normal GWD behavior. It should not synthesize routing when:

- no local 27B model is available
- the matching provider is remote
- the provider API is not OpenAI-compatible
- explicit `models` preferences are present
- explicit `dynamic_routing` preferences are present
- model IDs are similar but not in the Qwen3.6 27B/35B-A3B families

Passive discovery failures are non-fatal. Startup should not warn when no local `vllm-metal` server is running.

Only clear local resource/load failures trigger 35B-A3B suppression:

- out of memory
- failed allocation
- insufficient memory
- model load failure
- runner process termination
- server-side errors that mention load or memory pressure

Do not suppress 35B-A3B for:

- invalid request shape
- tool-call errors
- user cancellation
- auth/config errors
- ordinary model output quality issues
- context-length errors from a server started below 192K

If the server rejects 192K because it was started with a lower `--max-model-len`, the user should lower `context_window_override` or restart `vllm-metal` with the documented settings. GWD should report this as runtime configuration mismatch rather than silently assuming TurboQuant failed.

## Testing

Focused unit coverage should verify:

- The profile activates for a localhost OpenAI-compatible provider exposing `Qwen/Qwen3.6-27B-FP8`.
- Remote endpoints with matching IDs are ignored.
- Similar Qwen model IDs are ignored.
- Passive discovery registers a session-local provider for a default-port 27B server.
- Failed passive discovery on closed ports is silent outside verbose diagnostics.
- With only 27B present, light, standard, and heavy route to 27B.
- With separate local 27B and 35B-A3B providers present, heavy routes to 35B-A3B.
- Explicit `models` preferences disable synthesis.
- Explicit `dynamic_routing` preferences disable synthesis.
- `context_window_override` wins over the default `196608`.
- The effective context helper is used in normal dispatch, pinned model reapply, and fallback recovery.
- 35B-A3B resource failures suppress 35B-A3B for the current run and retry on 27B.
- Non-resource errors do not trigger fallback suppression.
- Suppression clears between auto-mode runs.

Verification should include:

- the new targeted vLLM Metal profile tests
- the existing auto-model-selection tests
- the existing context-budget tests
- the existing provider-error/recovery tests
- `npm run typecheck:extensions`
- `git diff --check`

## Acceptance Criteria

- A user running one local `vllm-metal` 27B server on the default port gets automatic 192K GWD budgeting and 27B routing without editing `models.json` or setting explicit dynamic routing preferences.
- A user running separate local 27B and 35B-A3B endpoints gets 27B for light/standard and 35B-A3B for heavy phases.
- A user running custom local ports can still configure endpoints through `models.json`.
- A user running only 27B does not get repeated missing-heavy noise; heavy work continues on 27B.
- Explicit routing and context preferences override the synthesized profile.
- Remote OpenAI-compatible Qwen endpoints are not affected.
- TurboQuant setup is documented as a `vllm-metal` startup requirement.
- 35B-A3B resource failures recover to 27B without retrying 35B repeatedly in the same auto run.
