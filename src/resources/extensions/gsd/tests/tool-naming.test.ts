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
  "gsd_decision_save",
  "gsd_requirement_update",
  "gsd_requirement_save",
  "gsd_summary_save",
  "gsd_milestone_generate_id",
  "gsd_plan_milestone",
  "gsd_plan_slice",
  "gsd_plan_task",
  "gsd_task_complete",
  "gsd_slice_complete",
  "gsd_skip_slice",
  "gsd_complete_milestone",
  "gsd_validate_milestone",
  "gsd_replan_slice",
  "gsd_reassess_roadmap",
  "gsd_task_reopen",
  "gsd_slice_reopen",
  "gsd_milestone_reopen",
  "gsd_save_gate_result",
] as const;

const REMOVED_ALIAS_NAMES = [
  "gsd_save_decision",
  "gsd_update_requirement",
  "gsd_save_requirement",
  "gsd_save_summary",
  "gsd_generate_milestone_id",
  "gsd_milestone_plan",
  "gsd_slice_plan",
  "gsd_task_plan",
  "gsd_complete_task",
  "gsd_complete_slice",
  "gsd_milestone_complete",
  "gsd_milestone_validate",
  "gsd_slice_replan",
  "gsd_roadmap_reassess",
  "gsd_reopen_task",
  "gsd_reopen_slice",
  "gsd_reopen_milestone",
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
