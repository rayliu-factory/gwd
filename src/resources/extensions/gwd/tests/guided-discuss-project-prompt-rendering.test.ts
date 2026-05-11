// Project/App: GWD-2
// File Purpose: Verifies the guided project discussion prompt renders its core interview and persistence contracts.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("guided project prompt renders compact interview and artifact guidance", async (t) => {
  const previousGwdHome = process.env.GWD_HOME;
  const providedGwdHome = process.env.GWD_TEST_HOME;
  const isolatedHome = providedGwdHome ?? mkdtempSync(join(tmpdir(), "gwd-guided-project-render-"));
  process.env.GWD_HOME = isolatedHome;
  t.after(() => {
    if (previousGwdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = previousGwdHome;
    if (!providedGwdHome) rmSync(isolatedHome, { recursive: true, force: true });
  });

  const { loadPrompt } = await import(`../prompt-loader.ts?test=${Date.now()}`);
  const prompt = loadPrompt("guided-discuss-project", {
    workingDirectory: process.env.GWD_TEST_WORKSPACE_ROOT ?? process.cwd(),
    structuredQuestionsAvailable: "true",
    inlinedTemplates: "## Project\n\n## Project Shape\n\n## Capability Contract\n\n## Milestone Sequence",
    commitInstruction: "Do not commit during this test.",
  });

  assert.match(prompt, /What do you want to build\?/);
  assert.match(prompt, /Project shape: simple/);
  assert.match(prompt, /Default to `complex` when uncertain/);
  assert.match(prompt, /3 or 4 concrete, researched options/);
  assert.match(prompt, /"Other — let me discuss"/);
  assert.match(prompt, /depth_verification_project_confirm/);
  assert.match(prompt, /artifact_type: "PROJECT"/);
  assert.match(prompt, /omit `milestone_id`/);
  assert.match(prompt, /Do NOT use `artifact_type: "CONTEXT"` and do NOT pass `milestone_id: "PROJECT"`/);
  assert.match(prompt, /\*\*Complexity:\*\* simple/);
  assert.match(prompt, /\*\*Complexity:\*\* complex/);
  assert.doesNotMatch(prompt, /\{\{[a-zA-Z][a-zA-Z0-9_]*\}\}/);
});
