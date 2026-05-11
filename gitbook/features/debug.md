# Debug Sessions

`/gwd debug` creates persistent debug sessions so you can investigate issues across multiple turns without losing context.

## Quick Start

```bash
# Start a standard debug session (find + fix)
/gwd debug checkout returns 500 after login

# List persisted sessions
/gwd debug list

# Inspect one session
/gwd debug status <slug>

# Resume one session
/gwd debug continue <slug>

# Diagnose store health
/gwd debug --diagnose
```

{% hint style="info" %}
Debug session artifacts are persisted under `.gwd/debug/sessions/<slug>.json`, and each session has a companion log at `.gwd/debug/<slug>.log`.
{% endhint %}

## Command Family

| Command | Behavior |
|---------|----------|
| `/gwd debug <issue-text>` | Starts a new session in `mode=debug` and returns next actions (`status` / `continue`). |
| `/gwd debug list` | Lists healthy sessions and malformed artifacts found in `.gwd/debug/sessions/`. |
| `/gwd debug status <slug>` | Shows mode, status, phase, issue, artifact path, log path, update time, and `lastError`. |
| `/gwd debug continue <slug>` | Resumes a saved session and dispatches the next debug turn unless the session is already resolved. |
| `/gwd debug --diagnose [<slug> \| <issue text>]` | Runs diagnostics globally, on a single session slug, or starts a new root-cause-only diagnose session from issue text. |

## Diagnose Mode Details

`--diagnose` supports three implemented behaviors:

1. `/gwd debug --diagnose` → global artifact health diagnostics (healthy vs malformed counts plus remediation hints).
2. `/gwd debug --diagnose <slug>` → targeted diagnostics for one existing session.
3. `/gwd debug --diagnose <issue text>` (multi-token) → starts a new `mode=diagnose` session with `find_root_cause_only` intent.

Single-token non-slug targets are rejected with usage guidance.

## Checkpoints, TDD Gate, and Continue Behavior

When you run `/gwd debug continue <slug>`, dispatch behavior adapts to persisted session state:

- **Checkpoint present** (`awaitingResponse=true`): continue runs through the session manager with checkpoint context.
- **TDD gate phase `pending`**: root-cause/TDD-first flow (write a failing test first, do not fix yet).
- **TDD gate phase `red`**: transitions to `red → green` fix phase.
- **TDD gate phase `green`**: continues with verification after the test is passing.
- **Specialist review metadata** (when present): carries prior specialist context into the resumed session.

Checkpoint types persisted in session artifacts:
- `human-verify`
- `human-action`
- `decision`
- `root-cause-found`
- `inconclusive`

## Troubleshooting

- Unknown slug for `status`, `continue`, or targeted `--diagnose` prompts you to run `/gwd debug list`.
- Unknown debug flags (for example, `--wat`) return an explicit warning and usage text.
- Malformed JSON artifacts are surfaced by both `list` and `--diagnose`, with remediation guidance to repair/remove broken files under `.gwd/debug/sessions/`.
