// Project/App: GWD-2
// File Purpose: Verifies canonical DB tool registration after the hard namespace cutover.

import { test } from "node:test";
import assert from "node:assert/strict";

import { registerDbTools } from "../bootstrap/db-tools.ts";

function makeMockPi() {
  const tools: any[] = [];
  return {
    registerTool: (tool: any) => tools.push(tool),
    tools,
  } as any;
}

const CANONICAL_TOOL_NAMES = [
  "gwd_decision_save",
  "gwd_requirement_update",
  "gwd_requirement_save",
  "gwd_summary_save",
  "gwd_milestone_generate_id",
  "gwd_plan_milestone",
  "gwd_plan_slice",
  "gwd_plan_task",
  "gwd_task_complete",
  "gwd_slice_complete",
  "gwd_skip_slice",
  "gwd_complete_milestone",
  "gwd_validate_milestone",
  "gwd_replan_slice",
  "gwd_reassess_roadmap",
  "gwd_task_reopen",
  "gwd_slice_reopen",
  "gwd_milestone_reopen",
  "gwd_save_gate_result",
] as const;

const REMOVED_ALIAS_NAMES = [
  "gwd_save_decision",
  "gwd_update_requirement",
  "gwd_save_requirement",
  "gwd_save_summary",
  "gwd_generate_milestone_id",
  "gwd_milestone_plan",
  "gwd_slice_plan",
  "gwd_task_plan",
  "gwd_complete_task",
  "gwd_complete_slice",
  "gwd_milestone_complete",
  "gwd_milestone_validate",
  "gwd_slice_replan",
  "gwd_roadmap_reassess",
  "gwd_reopen_task",
  "gwd_reopen_slice",
  "gwd_reopen_milestone",
] as const;

test("registerDbTools registers only canonical DB workflow tools", () => {
  const pi = makeMockPi();
  registerDbTools(pi);
  const toolNames = pi.tools.map((tool: any) => tool.name).sort();

  assert.deepEqual(toolNames, [...CANONICAL_TOOL_NAMES].sort());
});

test("legacy compatibility alias tools are not registered", () => {
  const pi = makeMockPi();
  registerDbTools(pi);
  const registered = new Set(pi.tools.map((tool: any) => tool.name));

  for (const aliasName of REMOVED_ALIAS_NAMES) {
    assert.equal(registered.has(aliasName), false, `${aliasName} must not be registered after hard cutover`);
  }
});

test("tool descriptions and prompt guidelines do not advertise aliases", () => {
  const pi = makeMockPi();
  registerDbTools(pi);

  for (const tool of pi.tools as any[]) {
    assert.ok(!/alias/i.test(tool.description ?? ""), `${tool.name} description must not advertise aliases`);
    const guidelines = Array.isArray(tool.promptGuidelines) ? tool.promptGuidelines.join(" ") : "";
    assert.ok(!/alias/i.test(guidelines), `${tool.name} prompt guidelines must not advertise aliases`);
  }
});
