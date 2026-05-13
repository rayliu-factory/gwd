# vLLM Metal TurboQuant Qwen3.6 Helper

This helper prints and optionally runs the recommended `vllm-metal` startup commands for Qwen3.6 27B and 35B-A3B on a 48GB Apple Silicon Pro machine. It is a convenience wrapper around the server launch command; GWD still treats `vllm-metal` as an external OpenAI-compatible runtime.

## Prerequisites

- macOS on Apple Silicon, tuned for a 48GB M-series Pro machine.
- `vllm-metal` installed and available as `vllm`.
- Enough free disk space for the Qwen model weights.
- One terminal per long-running `vllm serve` process.

If `vllm` is not installed, follow the vLLM Metal installation guide:

```text
https://docs.vllm.ai/projects/vllm-metal/en/latest/installation/
```

## Quick Start

From the repository root, print the default 27B startup command:

```bash
npm run setup:vllm-metal-qwen36
```

Print both the default 27B endpoint and the optional 35B-A3B heavy endpoint:

```bash
npm run setup:vllm-metal-qwen36 -- --model both
```

Print both commands plus a `~/.gwd/agent/models.json` example:

```bash
npm run setup:vllm-metal-qwen36 -- --model both --models-json
```

## Start the 27B Default Endpoint

Use 27B as the default endpoint on a 48GB machine:

```bash
npm run setup:vllm-metal-qwen36 -- --start 27b
```

This starts:

```bash
VLLM_METAL_USE_PAGED_ATTENTION=1 vllm serve Qwen/Qwen3.6-27B-FP8 \
  --host 127.0.0.1 \
  --port 8000 \
  --max-model-len 196608 \
  --reasoning-parser qwen3 \
  --additional-config '{"turboquant":true,"k_quant":"q8_0","v_quant":"q3_0"}'
```

GWD auto-detects this endpoint at `http://127.0.0.1:8000/v1` or `http://localhost:8000/v1`.

## Optional 35B-A3B Heavy Endpoint

Run the 35B-A3B endpoint only when you want a separate heavy-phase server. Start it in a separate terminal:

```bash
npm run setup:vllm-metal-qwen36 -- --start 35b
```

This starts:

```bash
VLLM_METAL_USE_PAGED_ATTENTION=1 vllm serve Qwen/Qwen3.6-35B-A3B-FP8 \
  --host 127.0.0.1 \
  --port 8001 \
  --max-model-len 196608 \
  --reasoning-parser qwen3 \
  --additional-config '{"turboquant":true,"k_quant":"q8_0","v_quant":"q3_0"}'
```

GWD auto-mode uses 27B for light and standard work. If a local 35B-A3B endpoint is available, heavy work can route there and fall back to 27B after local resource or model-load failures.

## Custom Ports

Use `--port` for a single selected model:

```bash
npm run setup:vllm-metal-qwen36 -- --model 27b --port 8100
```

Use `--port27` and `--port35` when printing both endpoints:

```bash
npm run setup:vllm-metal-qwen36 -- --model both --port27 8100 --port35 8101 --models-json
```

If you use custom ports, add the printed provider entries to `~/.gwd/agent/models.json` so GWD can find those endpoints.

## Lower the Context Target

The default profile uses a 196608-token context target. If the machine is under memory pressure, lower the server context and keep GWD aligned:

```bash
npm run setup:vllm-metal-qwen36 -- --model 27b --max-model-len 131072
```

Then either use the matching `models.json` output or set the project preference:

```md
---
context_window_override: 131072
---
```

## Options

```text
--model 27b|35b|both     Select the server command to print. Defaults to 27b.
--both                   Alias for --model both.
--start [27b|35b]        Start one selected long-running vLLM server.
--models-json            Include a ~/.gwd/agent/models.json example.
--host HOST              Bind host. Defaults to 127.0.0.1.
--port PORT              Override the selected single-model port.
--port27 PORT            Override the 27B port. Defaults to 8000.
--port35 PORT            Override the 35B-A3B port. Defaults to 8001.
--max-model-len TOKENS   Defaults to 196608 for the 48GB profile.
--k-quant VALUE          Defaults to q8_0.
--v-quant VALUE          Defaults to q3_0.
--vllm-bin PATH          vLLM executable. Defaults to vllm.
--help                   Show help.
```

## Notes

- The helper does not install `vllm-metal`.
- The helper does not modify GWD preferences or `models.json`.
- `--start both` is intentionally rejected because each server is long-running and should have its own terminal.
- The recommended 48GB path is to start 27B first. Start 35B-A3B only when you specifically want a separate heavy endpoint.
