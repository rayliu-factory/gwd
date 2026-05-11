// Project/App: GWD-2
// File Purpose: Tests for opt-in GWD tool surface reduction.

import assert from "node:assert/strict";
import test from "node:test";

import { buildMinimalAutoGwdToolSet, buildMinimalGwdToolSet, buildMinimalGwdWorkflowToolSet, buildRequestScopedGwdToolSet, MINIMAL_AUTO_BASE_TOOL_NAMES, MINIMAL_GWD_TOOL_NAMES, restoreGwdWorkflowTools, scopeGwdWorkflowToolsForDispatch } from "../bootstrap/register-hooks.ts";

test("buildMinimalGwdToolSet preserves non-GWD tools and replaces broad GWD surface", () => {
  const result = buildMinimalGwdToolSet([
    "bash",
    "read",
    "browser_open",
    "gwd_plan_milestone",
    "gwd_task_complete",
    "gwd_exec",
    "gwd_exec_search",
    "gwd_resume",
    "gwd_milestone_status",
    "gwd_checkpoint_db",
    "memory_query",
    "capture_thought",
    "gwd_graph",
  ]);

  assert.ok(result.includes("bash"));
  assert.ok(result.includes("read"));
  assert.ok(result.includes("browser_open"));
  for (const toolName of MINIMAL_GWD_TOOL_NAMES) {
    assert.ok(result.includes(toolName), `expected ${toolName}`);
  }
  assert.ok(!result.includes("gwd_plan_milestone"));
  assert.ok(!result.includes("gwd_task_complete"));
  assert.ok(!result.includes("gwd_graph"));
});

test("buildMinimalGwdToolSet deduplicates preserved and minimal tools", () => {
  const result = buildMinimalGwdToolSet(["bash", "bash", "memory_query"]);

  assert.deepEqual(result.filter((toolName) => toolName === "bash"), ["bash"]);
  assert.deepEqual(result.filter((toolName) => toolName === "memory_query"), ["memory_query"]);
});

test("buildMinimalGwdToolSet does not reintroduce provider-filtered GWD tools", () => {
  const result = buildMinimalGwdToolSet(["bash", "read", "memory_query"]);

  assert.deepEqual(result, ["bash", "read", "memory_query"]);
  assert.ok(!result.includes("gwd_exec"));
});

test("buildMinimalAutoGwdToolSet keeps unit-specific completion tools without aliases", () => {
  const result = buildMinimalAutoGwdToolSet([
    "ask_user_questions",
    "bash",
    "read",
    "lsp",
    "browser_click",
    "gwd_task_complete",
    "gwd_complete_task",
    "gwd_exec",
    "gwd_exec_search",
    "gwd_resume",
    "gwd_milestone_status",
    "gwd_checkpoint_db",
    "gwd_slice_complete",
    "gwd_complete_slice",
    "memory_query",
    "capture_thought",
  ], "execute-task");

  assert.ok(result.includes("ask_user_questions"));
  assert.ok(result.includes("bash"));
  assert.ok(result.includes("read"));
  assert.ok(result.includes("gwd_task_complete"));
  assert.ok(result.includes("memory_query"));
  assert.ok(!result.includes("lsp"));
  assert.ok(!result.includes("browser_click"));
  assert.ok(!result.includes("gwd_complete_task"));
  assert.ok(!result.includes("gwd_slice_complete"));
  assert.ok(!result.includes("gwd_complete_slice"));
});

test("buildMinimalAutoGwdToolSet keeps only the auto base non-GWD tools", () => {
  const result = buildMinimalAutoGwdToolSet([
    "ask_user_questions",
    "bash",
    "bg_shell",
    "browser_wait_for",
    "edit",
    "glob",
    "grep",
    "lsp",
    "ls",
    "mac_find",
    "read",
    "subagent",
    "write",
    "gwd_exec",
    "gwd_exec_search",
    "gwd_resume",
    "gwd_milestone_status",
    "gwd_checkpoint_db",
    "memory_query",
    "capture_thought",
  ], "execute-task");

  for (const toolName of MINIMAL_AUTO_BASE_TOOL_NAMES) {
    assert.ok(result.includes(toolName), `expected ${toolName}`);
  }
  assert.ok(!result.includes("browser_wait_for"));
  assert.ok(!result.includes("lsp"));
  assert.ok(!result.includes("mac_find"));
  assert.ok(!result.includes("subagent"));
});

test("buildMinimalAutoGwdToolSet includes closeout tool for complete-slice", () => {
  const result = buildMinimalAutoGwdToolSet([
    "bash",
    "read",
    "subagent",
    "gwd_exec",
    "gwd_exec_search",
    "gwd_resume",
    "gwd_milestone_status",
    "gwd_checkpoint_db",
    "gwd_task_complete",
    "gwd_slice_complete",
    "gwd_complete_slice",
    "memory_query",
    "capture_thought",
  ], "complete-slice");

  assert.ok(result.includes("gwd_slice_complete"));
  assert.ok(result.includes("subagent"));
  assert.ok(result.includes("capture_thought"));
  assert.ok(!result.includes("gwd_task_complete"));
  assert.ok(!result.includes("gwd_complete_slice"));
});

test("buildMinimalAutoGwdToolSet covers execute-task-simple", () => {
  const result = buildMinimalAutoGwdToolSet([
    "bash",
    "read",
    "gwd_task_complete",
    "gwd_decision_save",
    "gwd_plan_task",
    "memory_query",
    "capture_thought",
  ], "execute-task-simple");

  assert.ok(result.includes("gwd_task_complete"));
  assert.ok(result.includes("gwd_decision_save"));
  assert.ok(!result.includes("gwd_plan_task"));
});

test("buildMinimalGwdWorkflowToolSet keeps workflow GWD tools but drops broad non-GWD tools", () => {
  const result = buildMinimalGwdWorkflowToolSet([
    "ask_user_questions",
    "bash",
    "bg_shell",
    "browser_wait_for",
    "edit",
    "lsp",
    "mac_find",
    "read",
    "subagent",
    "write",
    "gwd_plan_milestone",
    "gwd_complete_milestone",
    "gwd_task_complete",
    "gwd_summary_save",
    "memory_query",
    "capture_thought",
    "gwd_exec",
    "gwd_exec_search",
    "gwd_resume",
    "gwd_milestone_status",
    "gwd_checkpoint_db",
    "gwd_graph",
  ]);

  assert.ok(result.includes("ask_user_questions"));
  assert.ok(result.includes("bash"));
  assert.ok(result.includes("bg_shell"));
  assert.ok(result.includes("read"));
  assert.ok(result.includes("write"));
  assert.ok(result.includes("gwd_plan_milestone"));
  assert.ok(result.includes("gwd_complete_milestone"));
  assert.ok(result.includes("gwd_task_complete"));
  assert.ok(result.includes("gwd_summary_save"));
  assert.ok(!result.includes("browser_wait_for"));
  assert.ok(!result.includes("lsp"));
  assert.ok(!result.includes("mac_find"));
  assert.ok(!result.includes("subagent"));
  assert.ok(!result.includes("gwd_graph"));
});

test("buildRequestScopedGwdToolSet scopes queued workflow custom-message requests", () => {
  const result = buildRequestScopedGwdToolSet([
    "ask_user_questions",
    "bash",
    "browser_wait_for",
    "lsp",
    "read",
    "write",
    "gwd_plan_milestone",
    "gwd_complete_milestone",
    "gwd_task_complete",
    "gwd_graph",
    "memory_query",
    "capture_thought",
  ], [{ customType: "gwd-run" }, { customType: "gwd-memory" }]);

  assert.ok(result);
  assert.ok(result.includes("ask_user_questions"));
  assert.ok(result.includes("bash"));
  assert.ok(result.includes("read"));
  assert.ok(result.includes("write"));
  assert.ok(result.includes("gwd_plan_milestone"));
  assert.ok(result.includes("gwd_complete_milestone"));
  assert.ok(!result.includes("browser_wait_for"));
  assert.ok(!result.includes("lsp"));
  assert.ok(!result.includes("gwd_graph"));
});

test("buildRequestScopedGwdToolSet ignores stale workflow messages outside the current request tail", () => {
  assert.equal(buildRequestScopedGwdToolSet(["bash", "gwd_plan_milestone"], []), undefined);
});

test("scopeGwdWorkflowToolsForDispatch applies and restores per-unit skill visibility", () => {
  const calls: Array<{ kind: "tools" | "skills"; value: string[] | undefined }> = [];
  let activeTools = [
    "bash",
    "read",
    "lsp",
    "gwd_plan_milestone",
    "gwd_decision_save",
    "memory_query",
    "capture_thought",
  ];
  let visibleSkills: string[] | undefined = ["previous-skill"];

  const state = scopeGwdWorkflowToolsForDispatch({
    getActiveTools: () => activeTools,
    setActiveTools: (names) => {
      activeTools = names;
      calls.push({ kind: "tools", value: names });
    },
    getVisibleSkills: () => visibleSkills,
    setVisibleSkills: (names) => {
      visibleSkills = names;
      calls.push({ kind: "skills", value: names });
    },
  }, "plan-milestone");

  assert.ok(state);
  assert.deepEqual(visibleSkills, [
    "write-milestone-brief",
    "decompose-into-slices",
    "design-an-interface",
    "grill-me",
    "write-docs",
    "api-design",
    "tdd",
    "verify-before-complete",
  ]);
  assert.ok(!activeTools.includes("lsp"));

  restoreGwdWorkflowTools({
    setActiveTools: (names) => {
      activeTools = names;
      calls.push({ kind: "tools", value: names });
    },
    setVisibleSkills: (names) => {
      visibleSkills = names;
      calls.push({ kind: "skills", value: names });
    },
  }, state);

  assert.deepEqual(activeTools, [
    "bash",
    "read",
    "lsp",
    "gwd_plan_milestone",
    "gwd_decision_save",
    "memory_query",
    "capture_thought",
  ]);
  assert.deepEqual(visibleSkills, ["previous-skill"]);
  assert.equal(calls.filter((call) => call.kind === "skills").length, 2);
});
