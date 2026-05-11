// Project/App: GWD-2
// File Purpose: Verifies the milestone planning prompt renders compact required guidance.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("plan-milestone prompt renders compact DB-backed planning guidance", async (t) => {
  const previousGsdHome = process.env.GWD_HOME;
  const providedGsdHome = process.env.GWD_TEST_HOME;
  const isolatedHome = providedGsdHome ?? mkdtempSync(join(tmpdir(), "gsd-plan-milestone-render-"));
  const fixtureRoot = process.env.GWD_TEST_WORKSPACE_ROOT ?? process.cwd();
  process.env.GWD_HOME = isolatedHome;
  t.after(() => {
    if (previousGsdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = previousGsdHome;
    if (!providedGsdHome) rmSync(isolatedHome, { recursive: true, force: true });
  });

  const { loadPrompt } = await import(`../prompt-loader.ts?test=${Date.now()}`);
  const prompt = loadPrompt("plan-milestone", {
    milestoneId: "M001",
    milestoneTitle: "Reduce prompt cost",
    workingDirectory: fixtureRoot,
    inlinedContext: "## Roadmap\n\nUse the roadmap template.",
    outputPath: ".gwd/milestones/M001/M001-ROADMAP.md",
    skillDiscoveryMode: "filtered",
    skillDiscoveryInstructions: "Use only relevant skills.",
    sourceFilePaths: "- src/resources/extensions/gwd/prompts/plan-milestone.md",
    researchOutputPath: ".gwd/milestones/M001/M001-RESEARCH.md",
    secretsOutputPath: ".gwd/milestones/M001/SECRETS.md",
  });

  assert.match(prompt, /Explore First, Then Decompose/);
  assert.match(prompt, /Call `gwd_plan_milestone`/);
  assert.match(prompt, /call `gwd_decision_save`/);
  assert.match(prompt, /Every relevant Active requirement must end as mapped/);
  assert.match(prompt, /Risk-first means proof-first/);
  assert.match(prompt, /Progressive Planning \(ADR-011\)/);
  assert.match(prompt, /Single-Slice Fast Path/);
  assert.match(prompt, /Secret Forecasting/);
  assert.doesNotMatch(prompt, /\{\{[a-zA-Z][a-zA-Z0-9_]*\}\}/);
});
