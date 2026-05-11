// Project/App: GWD-2
// File Purpose: Verifies the guided requirements discussion prompt renders core requirements and persistence contracts.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("guided requirements prompt renders compact capability and persistence guidance", async (t) => {
  const previousGwdHome = process.env.GWD_HOME;
  const providedGwdHome = process.env.GWD_TEST_HOME;
  const isolatedHome = providedGwdHome ?? mkdtempSync(join(tmpdir(), "gwd-guided-requirements-render-"));
  process.env.GWD_HOME = isolatedHome;
  t.after(() => {
    if (previousGwdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = previousGwdHome;
    if (!providedGwdHome) rmSync(isolatedHome, { recursive: true, force: true });
  });

  const { loadPrompt } = await import(`../prompt-loader.ts?test=${Date.now()}`);
  const prompt = loadPrompt("guided-discuss-requirements", {
    workingDirectory: process.env.GWD_TEST_WORKSPACE_ROOT ?? process.cwd(),
    structuredQuestionsAvailable: "true",
    inlinedTemplates: "## Active\n\n## Validated\n\n## Deferred\n\n## Out of Scope\n\n## Traceability\n\n## Coverage Summary",
    commitInstruction: "Do not commit during this test.",
  });

  assert.match(prompt, /PROJECT\.md missing/);
  assert.match(prompt, /Project Shape/);
  assert.match(prompt, /R###/);
  assert.match(prompt, /M###\/none yet/);
  assert.match(prompt, /never bare `none yet`/);
  assert.match(prompt, /3 or 4 concrete, researched options/);
  assert.match(prompt, /"Other — let me discuss"/);
  assert.match(prompt, /class-assignment and status questions are exempt/);
  assert.match(prompt, /artifact_type: "REQUIREMENTS-DRAFT"/);
  assert.match(prompt, /depth_verification_requirements_confirm/);
  assert.match(prompt, /gwd_requirement_save/);
  assert.match(prompt, /gwd_summary_save/);
  assert.match(prompt, /artifact_type: "REQUIREMENTS"/);
  assert.match(prompt, /Do NOT use `artifact_type: "CONTEXT"`/);
  assert.match(prompt, /Requirements written\./);
  assert.doesNotMatch(prompt, /\{\{[a-zA-Z][a-zA-Z0-9_]*\}\}/);
});
