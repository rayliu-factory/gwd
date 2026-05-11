<!-- Project/App: GWD -->
<!-- File Purpose: Token consumption savings PR evidence summary. -->

# Token Consumption Savings Evidence

This PR uses `PI_TOKEN_AUDIT=1` audit output to target repeat prompt cost at the final provider boundary without logging raw prompt, system, tool, tool-result, or user content.

## Measured Baselines

| Log | Rows | Estimated input tokens avg | Tool count avg | Tool schema chars avg | Custom chars avg | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `/tmp/gwd-token-audit-min-tools.log` | n/a | 45,504 | 44 | 43,971 | 55,657 | Initial minimal-tools sample still had high custom/context cost. |
| `/tmp/gwd-token-audit-min-tools-context-cap.log` | 14 | n/a | 138 | 137,296 | 20,210 | Context cap helped custom payloads, but full tool schema still dominated. |
| `/tmp/gwd-token-audit-auto-tools-before-start2.log` | 12 | n/a | 105 | 80,272 | 25,025 | Auto still carried broad workflow/tool surfaces. |
| `/tmp/gwd-token-audit-auto-tools-before-start3.log` | 7 | n/a | 15 | 17,224 | 22,026 | Strict auto scoping brought normal auto turns near the target surface. |
| `/tmp/gwd-token-audit-auto-tools-before-start4.log` | 4 | n/a | 15 | 16,313 | 38,707 | Auto tool schema stayed low; custom closeout context still spiked. |

Run 5 exposed the remaining workflow bucket:

| Surface | Rows | Estimated input tokens avg | Tool count avg | Tool schema chars avg | Custom chars avg |
| --- | ---: | ---: | ---: | ---: | ---: |
| `gwd-auto` | 5 | 20,775 | 15 | 16,818 | 16,499 |
| `gwd-run` | 7 | 73,367 | 102 | 76,520 | 104,122 |
| `gwd-doctor-heal` | 1 | 46,309 | 103 | 76,953 | 29,468 |

`toolResultChars` stayed at zero in the sampled logs, so tool-result replay compression remains deferred.

## Savings Implemented

- Final provider-boundary audit: `PI_TOKEN_AUDIT=1` reports metadata-only section sizes after context transforms and final tool filtering.
- UI semantics: session token/cost totals stay visible, but they are not presented as live context percentage.
- Provider request-time filtering: provider compatibility is applied immediately before send, then GWD workflow/auto scoping narrows the remaining compatible tools.
- GWD auto/workflow tool scoping: auto units, guided workflow dispatch, `gwd-run`, and `gwd-doctor-heal` use scoped tool surfaces with a full-tools escape hatch.
- Prompt/context cuts: hidden GWD context defaults to a cap, `KNOWLEDGE.md` defaults to a 12k cap, auto preambles stay bounded, and malformed summaries no longer inline unbounded legacy bodies.
- Workflow/doctor cuts: workflow dispatch uses a capped section-aware protocol excerpt, and doctor heal sends summary plus top actionable issues instead of duplicating the full report.
- Skill prompt visibility: GWD narrows `<available_skills>` per unit using the existing `skillFilter` prompt seam while keeping skills loaded and invocable.

## Local Verification

Targeted commands run in `.worktrees/token-consumption-savings-pr`:

```bash
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gwd/tests/token-tool-gating.test.ts src/resources/extensions/gwd/tests/system-context-memory.test.ts src/resources/extensions/gwd/tests/prompt-duplication-cuts.test.ts src/resources/extensions/gwd/tests/complete-milestone-excerpt.test.ts src/resources/extensions/gwd/tests/knowledge.test.ts src/resources/extensions/gwd/tests/workflow-protocol-excerpt.test.ts
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test vscode-extension/test/rpc-display-contract.test.ts
node --import ./src/resources/extensions/gwd/tests/resolve-ts.mjs --experimental-strip-types --test packages/pi-agent-core/src/token-audit.test.ts packages/pi-coding-agent/src/core/skill-tool.test.ts packages/pi-coding-agent/src/core/sdk-tool-filter.test.ts
npm run test:compile
node --test dist-test/packages/pi-agent-core/src/token-audit.test.js dist-test/packages/pi-agent-core/src/agent-loop.test.js
npm run typecheck:extensions
```
