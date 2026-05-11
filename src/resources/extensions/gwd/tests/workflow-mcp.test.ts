import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import {
  buildWorkflowMcpServers,
  detectWorkflowMcpLaunchConfig,
  getWorkflowTransportSupportError,
  getRequiredWorkflowToolsForAutoUnit,
  getRequiredWorkflowToolsForGuidedUnit,
  supportsStructuredQuestions,
  usesWorkflowMcpTransport,
} from "../workflow-mcp.ts";

type ElicitPayload = {
  message: string;
  requestedSchema: { properties: Record<string, unknown>; required?: string[] };
};

function extractElicitPayload(request: unknown): ElicitPayload {
  const payload = (request as { params?: unknown }).params ?? request;
  return payload as ElicitPayload;
}

test("guided execute-task requires canonical task completion tool", () => {
  assert.deepEqual(getRequiredWorkflowToolsForGuidedUnit("execute-task"), ["gwd_task_complete"]);
});

test("auto execute-task requires canonical task completion tool", () => {
  assert.deepEqual(getRequiredWorkflowToolsForAutoUnit("execute-task"), ["gwd_task_complete"]);
});

test("deep project setup units declare required workflow MCP tools", () => {
  assert.deepEqual(getRequiredWorkflowToolsForGuidedUnit("discuss-project"), [
    "ask_user_questions",
    "gwd_summary_save",
  ]);
  assert.deepEqual(getRequiredWorkflowToolsForGuidedUnit("discuss-requirements"), [
    "ask_user_questions",
    "gwd_requirement_save",
    "gwd_summary_save",
  ]);
  assert.deepEqual(getRequiredWorkflowToolsForGuidedUnit("research-decision"), [
    "ask_user_questions",
  ]);
  assert.deepEqual(getRequiredWorkflowToolsForAutoUnit("discuss-project"), [
    "ask_user_questions",
    "gwd_summary_save",
  ]);
  assert.deepEqual(getRequiredWorkflowToolsForAutoUnit("discuss-requirements"), [
    "ask_user_questions",
    "gwd_requirement_save",
    "gwd_summary_save",
  ]);
  assert.deepEqual(getRequiredWorkflowToolsForAutoUnit("research-decision"), [
    "ask_user_questions",
  ]);
});

test("detectWorkflowMcpLaunchConfig prefers explicit env override", () => {
  const launch = detectWorkflowMcpLaunchConfig("/tmp/project", {
    GWD_WORKFLOW_MCP_NAME: "workflow-tools",
    GWD_WORKFLOW_MCP_COMMAND: "node",
    GWD_WORKFLOW_MCP_ARGS: JSON.stringify(["dist/cli.js"]),
    GWD_WORKFLOW_MCP_ENV: JSON.stringify({ FOO: "bar" }),
    GWD_WORKFLOW_MCP_CWD: "/tmp/project",
    GWD_CLI_PATH: "/tmp/gwd",
  });

  assert.deepEqual(launch, {
    name: "workflow-tools",
    command: "node",
    args: ["dist/cli.js"],
    cwd: "/tmp/project",
    env: launch?.env,
  });
  assert.equal(launch?.env?.FOO, "bar");
  assert.equal(launch?.env?.GWD_CLI_PATH, "/tmp/gwd");
  assert.equal(launch?.env?.GWD_BIN_PATH, "/tmp/gwd");
  assert.equal(launch?.env?.GWD_PERSIST_WRITE_GATE_STATE, "1");
  assert.equal(launch?.env?.GWD_WORKFLOW_PROJECT_ROOT, "/tmp/project");
  assert.match(launch?.env?.GWD_WORKFLOW_EXECUTORS_MODULE ?? "", /workflow-tool-executors\.(js|ts)$/);
  assert.match(launch?.env?.GWD_WORKFLOW_WRITE_GATE_MODULE ?? "", /write-gate\.(js|ts)$/);
});

test("detectWorkflowMcpLaunchConfig normalizes explicit workflow MCP env CLI aliases", () => {
  const binOnly = detectWorkflowMcpLaunchConfig("/tmp/project", {
    GWD_WORKFLOW_MCP_COMMAND: "node",
    GWD_WORKFLOW_MCP_ENV: JSON.stringify({ GWD_BIN_PATH: "/tmp/gwd-bin" }),
  });
  assert.equal(binOnly?.env?.GWD_CLI_PATH, "/tmp/gwd-bin");
  assert.equal(binOnly?.env?.GWD_BIN_PATH, "/tmp/gwd-bin");

  const cliOnly = detectWorkflowMcpLaunchConfig("/tmp/project", {
    GWD_WORKFLOW_MCP_COMMAND: "node",
    GWD_WORKFLOW_MCP_ENV: JSON.stringify({ GWD_CLI_PATH: "/tmp/gwd-cli" }),
  });
  assert.equal(cliOnly?.env?.GWD_CLI_PATH, "/tmp/gwd-cli");
  assert.equal(cliOnly?.env?.GWD_BIN_PATH, "/tmp/gwd-cli");
});

test("buildWorkflowMcpServers mirrors explicit launch config", () => {
  const servers = buildWorkflowMcpServers("/tmp/project", {
    GWD_WORKFLOW_MCP_COMMAND: "node",
    GWD_WORKFLOW_MCP_ARGS: JSON.stringify(["dist/cli.js"]),
  });

  assert.deepEqual(servers, {
    "gwd-workflow": {
      command: "node",
      args: ["dist/cli.js"],
      env: servers?.["gwd-workflow"]?.env,
    },
  });
  assert.equal((servers?.["gwd-workflow"]?.env as Record<string, string> | undefined)?.GWD_PERSIST_WRITE_GATE_STATE, "1");
  assert.equal((servers?.["gwd-workflow"]?.env as Record<string, string> | undefined)?.GWD_WORKFLOW_PROJECT_ROOT, "/tmp/project");
  assert.match((servers?.["gwd-workflow"]?.env as Record<string, string> | undefined)?.GWD_WORKFLOW_EXECUTORS_MODULE ?? "", /workflow-tool-executors\.(js|ts)$/);
  assert.match((servers?.["gwd-workflow"]?.env as Record<string, string> | undefined)?.GWD_WORKFLOW_WRITE_GATE_MODULE ?? "", /write-gate\.(js|ts)$/);
});

test("detectWorkflowMcpLaunchConfig resolves the bundled server from GWD_PROJECT_ROOT", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "gwd-workflow-root-"));
  const worktreeRoot = mkdtempSync(join(tmpdir(), "gwd-workflow-worktree-"));
  const cliPath = join(repoRoot, "packages", "mcp-server", "dist", "cli.js");

  mkdirSync(join(repoRoot, "packages", "mcp-server", "dist"), { recursive: true });
  writeFileSync(cliPath, "#!/usr/bin/env node\n", "utf-8");

  const launch = detectWorkflowMcpLaunchConfig(worktreeRoot, {
    GWD_PROJECT_ROOT: repoRoot,
  });

  assert.deepEqual(launch, {
    name: "gwd-workflow",
    command: process.execPath,
    args: [cliPath],
    cwd: repoRoot,
    env: launch?.env,
  });
  assert.equal(launch?.env?.GWD_PERSIST_WRITE_GATE_STATE, "1");
  assert.equal(launch?.env?.GWD_WORKFLOW_PROJECT_ROOT, repoRoot);
  assert.match(launch?.env?.GWD_WORKFLOW_EXECUTORS_MODULE ?? "", /workflow-tool-executors\.(js|ts)$/);
  assert.match(launch?.env?.GWD_WORKFLOW_WRITE_GATE_MODULE ?? "", /write-gate\.(js|ts)$/);
});

test("detectWorkflowMcpLaunchConfig resolves the bundled server from GWD_BIN_PATH ancestry", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "gwd-workflow-root-"));
  const worktreeRoot = mkdtempSync(join(tmpdir(), "gwd-workflow-worktree-"));
  const cliPath = join(repoRoot, "packages", "mcp-server", "dist", "cli.js");
  const devCliPath = join(repoRoot, "scripts", "dev-cli.js");

  mkdirSync(join(repoRoot, "packages", "mcp-server", "dist"), { recursive: true });
  mkdirSync(join(repoRoot, "scripts"), { recursive: true });
  writeFileSync(cliPath, "#!/usr/bin/env node\n", "utf-8");
  writeFileSync(devCliPath, "#!/usr/bin/env node\n", "utf-8");

  const launch = detectWorkflowMcpLaunchConfig(worktreeRoot, {
    GWD_BIN_PATH: devCliPath,
  });

  assert.deepEqual(launch, {
    name: "gwd-workflow",
    command: process.execPath,
    args: [cliPath],
    cwd: worktreeRoot,
    env: launch?.env,
  });
  assert.equal(launch?.env?.GWD_CLI_PATH, devCliPath);
  assert.equal(launch?.env?.GWD_BIN_PATH, devCliPath);
  assert.equal(launch?.env?.GWD_PERSIST_WRITE_GATE_STATE, "1");
  assert.equal(launch?.env?.GWD_WORKFLOW_PROJECT_ROOT, worktreeRoot);
  assert.match(launch?.env?.GWD_WORKFLOW_EXECUTORS_MODULE ?? "", /workflow-tool-executors\.(js|ts)$/);
  assert.match(launch?.env?.GWD_WORKFLOW_WRITE_GATE_MODULE ?? "", /write-gate\.(js|ts)$/);
});

test("detectWorkflowMcpLaunchConfig resolves the bundled server relative to the installed GWD package", () => {
  const launch = detectWorkflowMcpLaunchConfig("/tmp/project", {
    GWD_BIN_PATH: "/tmp/gwd-loader.js",
  });

  assert.equal(launch?.command, process.execPath);
  assert.equal(launch?.cwd, "/tmp/project");
  assert.equal(launch?.env?.GWD_CLI_PATH, "/tmp/gwd-loader.js");
  assert.equal(launch?.env?.GWD_BIN_PATH, "/tmp/gwd-loader.js");
  assert.equal(launch?.env?.GWD_WORKFLOW_PROJECT_ROOT, "/tmp/project");
  assert.match(launch?.env?.GWD_WORKFLOW_EXECUTORS_MODULE ?? "", /workflow-tool-executors\.(js|ts)$/);
  assert.match(launch?.env?.GWD_WORKFLOW_WRITE_GATE_MODULE ?? "", /write-gate\.(js|ts)$/);
  assert.equal(typeof launch?.args?.[0], "string");
  assert.match(launch?.args?.[0] ?? "", /packages[\/\\]mcp-server[\/\\](dist[\/\\]cli\.js|src[\/\\]cli\.ts)$/);
  if ((launch?.args?.[0] ?? "").endsWith(".ts")) {
    assert.match(launch?.env?.NODE_OPTIONS ?? "", /--experimental-strip-types/);
    assert.match(launch?.env?.NODE_OPTIONS ?? "", /resolve-ts\.mjs/);
  }
});

test("detectWorkflowMcpLaunchConfig resolves the bundled server relative to the package without env hints", () => {
  const launch = detectWorkflowMcpLaunchConfig("/tmp/project", {});

  assert.equal(launch?.command, process.execPath);
  assert.equal(launch?.cwd, "/tmp/project");
  assert.equal(launch?.env?.GWD_CLI_PATH, undefined);
  assert.equal(launch?.env?.GWD_BIN_PATH, undefined);
  assert.equal(launch?.env?.GWD_WORKFLOW_PROJECT_ROOT, "/tmp/project");
  assert.match(launch?.env?.GWD_WORKFLOW_EXECUTORS_MODULE ?? "", /workflow-tool-executors\.(js|ts)$/);
  assert.match(launch?.env?.GWD_WORKFLOW_WRITE_GATE_MODULE ?? "", /write-gate\.(js|ts)$/);
  assert.equal(typeof launch?.args?.[0], "string");
  assert.match(launch?.args?.[0] ?? "", /packages[\/\\]mcp-server[\/\\](dist[\/\\]cli\.js|src[\/\\]cli\.ts)$/);
  if ((launch?.args?.[0] ?? "").endsWith(".ts")) {
    assert.match(launch?.env?.NODE_OPTIONS ?? "", /--experimental-strip-types/);
    assert.match(launch?.env?.NODE_OPTIONS ?? "", /resolve-ts\.mjs/);
  }
});

test("workflow MCP launch config reaches mutation tools over stdio", async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), "gwd-workflow-transport-"));
  mkdirSync(join(projectRoot, ".gwd"), { recursive: true });
  // Isolate the spawned MCP server from the developer's real ~/.gwd so it
  // can't pick up a configured Discord/Slack/Telegram channel from global
  // PREFERENCES.md and route ask_user_questions through a remote adapter
  // instead of MCP elicitation.
  const isolatedGsdHome = mkdtempSync(join(tmpdir(), "gwd-workflow-home-"));

  const launch = detectWorkflowMcpLaunchConfig(projectRoot, {});
  assert.ok(launch, "expected a workflow MCP launch config");
  assert.match(
    launch.env?.GWD_WORKFLOW_EXECUTORS_MODULE ?? "",
    /(dist[\/\\]resources[\/\\]extensions[\/\\]gwd[\/\\]tools[\/\\]workflow-tool-executors\.js|src[\/\\]resources[\/\\]extensions[\/\\]gwd[\/\\]tools[\/\\]workflow-tool-executors\.(js|ts))$/,
  );
  assert.match(
    launch.env?.GWD_WORKFLOW_WRITE_GATE_MODULE ?? "",
    /(dist[\/\\]resources[\/\\]extensions[\/\\]gwd[\/\\]bootstrap[\/\\]write-gate\.js|src[\/\\]resources[\/\\]extensions[\/\\]gwd[\/\\]bootstrap[\/\\]write-gate\.(js|ts))$/,
  );
  if ((launch.env?.GWD_WORKFLOW_EXECUTORS_MODULE ?? "").endsWith(".ts")) {
    assert.match(launch.env?.NODE_OPTIONS ?? "", /--experimental-strip-types/);
    assert.match(launch.env?.NODE_OPTIONS ?? "", /resolve-ts\.mjs/);
  }

  const client = new Client(
    { name: "workflow-mcp-transport-test", version: "1.0.0" },
    { capabilities: { elicitation: {} } },
  );
  client.setRequestHandler(ElicitRequestSchema, async (request) => {
    const elicitation = extractElicitPayload(request as unknown);

    assert.match(elicitation.message, /Please answer the following question/);
    assert.ok(elicitation.requestedSchema.properties.transport_mode);
    assert.ok(elicitation.requestedSchema.properties["transport_mode__note"]);
    assert.ok(elicitation.requestedSchema.required?.includes("transport_mode"));

    return {
      action: "accept",
      content: {
        transport_mode: "None of the above",
        transport_mode__note: "Need Windows-safe MCP elicitation.",
      },
    };
  });
  const transport = new StdioClientTransport({
    command: launch.command,
    args: launch.args,
    env: {
      ...process.env,
      ...launch.env,
      GWD_HOME: isolatedGsdHome,
      DISCORD_BOT_TOKEN: "",
      SLACK_BOT_TOKEN: "",
      TELEGRAM_BOT_TOKEN: "",
    } as Record<string, string>,
    cwd: launch.cwd,
    stderr: "pipe",
  });

  try {
    await client.connect(transport, { timeout: 30_000 });

    const tools = await client.listTools(undefined, { timeout: 30_000 });
    assert.ok(
      (tools.tools ?? []).some((tool) => tool.name === "gwd_plan_slice"),
      "expected workflow MCP surface to expose gwd_plan_slice",
    );
    assert.ok(
      (tools.tools ?? []).some((tool) => tool.name === "ask_user_questions"),
      "expected workflow MCP surface to expose ask_user_questions",
    );

    const askResult = await client.callTool(
      {
        name: "ask_user_questions",
        arguments: {
          questions: [
            {
              id: "transport_mode",
              header: "Transport",
              question: "How should the workflow prompt be delivered?",
              options: [
                { label: "Local UI", description: "Use the host tool UI." },
                { label: "Remote UI", description: "Use a remote response channel." },
              ],
            },
          ],
        },
      },
      undefined,
      { timeout: 30_000 },
    );
    assert.equal(askResult.isError, undefined);
    assert.equal(
      ((askResult.content as Array<{ text?: string }>)?.[0])?.text ?? "",
      JSON.stringify({
        answers: {
          transport_mode: {
            answers: ["None of the above", "user_note: Need Windows-safe MCP elicitation."],
          },
        },
      }),
    );

    const milestoneResult = await client.callTool(
      {
        name: "gwd_plan_milestone",
        arguments: {
          projectDir: projectRoot,
          milestoneId: "M001",
          title: "Transport planning",
          vision: "Verify stdio workflow MCP uses the executor bridge.",
          slices: [
            {
              sliceId: "S01",
              title: "Bridge path",
              risk: "low",
              depends: [],
              demo: "Milestone planning succeeds over stdio MCP.",
              goal: "Prove the executor bridge works in the spawned server.",
              successCriteria: "gwd_plan_slice can write plan artifacts.",
              proofLevel: "integration",
              integrationClosure: "Stdio MCP client reaches the workflow executor bridge.",
              observabilityImpact: "Regression test covers the spawned-server path.",
            },
          ],
        },
      },
      undefined,
      { timeout: 30_000 },
    );
    assert.equal(milestoneResult.isError, undefined);
    assert.match(
      ((milestoneResult.content as Array<{ text?: string }>)?.[0])?.text ?? "",
      /Planned milestone M001/,
    );

    const sliceResult = await client.callTool(
      {
        name: "gwd_plan_slice",
        arguments: {
          projectDir: projectRoot,
          milestoneId: "M001",
          sliceId: "S01",
          goal: "Persist slice planning over the spawned MCP transport.",
          tasks: [
            {
              taskId: "T01",
              title: "Connect the bridge",
              description: "Ensure the workflow executor bridge resolves in the child process.",
              estimate: "10m",
              files: ["src/resources/extensions/gwd/workflow-mcp.ts"],
              verify: "node --test",
              inputs: ["M001-ROADMAP.md"],
              expectedOutput: ["S01-PLAN.md", "T01-PLAN.md"],
            },
          ],
        },
      },
      undefined,
      { timeout: 30_000 },
    );
    assert.equal(sliceResult.isError, undefined);
    assert.match(
      ((sliceResult.content as Array<{ text?: string }>)?.[0])?.text ?? "",
      /Planned slice S01/,
    );
    assert.ok(
      existsSync(join(projectRoot, ".gwd", "milestones", "M001", "slices", "S01", "S01-PLAN.md")),
      "expected slice plan artifact to be written through stdio MCP",
    );
    assert.ok(
      existsSync(
        join(projectRoot, ".gwd", "milestones", "M001", "slices", "S01", "tasks", "T01-PLAN.md"),
      ),
      "expected task plan artifact to be written through stdio MCP",
    );
  } finally {
    await client.close().catch(() => {});
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(isolatedGsdHome, { recursive: true, force: true });
  }
});

test("workflow MCP ask_user_questions uses stdio elicitation round-trip", async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), "gwd-workflow-elicit-"));
  mkdirSync(join(projectRoot, ".gwd"), { recursive: true });
  const isolatedGsdHome = mkdtempSync(join(tmpdir(), "gwd-workflow-home-"));

  const launch = detectWorkflowMcpLaunchConfig(projectRoot, {});
  assert.ok(launch, "expected a workflow MCP launch config");

  const client = new Client(
    { name: "workflow-mcp-elicit-test", version: "1.0.0" },
    { capabilities: { elicitation: {} } },
  );
  let requestSeen: {
    message: string;
    requestedSchema: { properties: Record<string, unknown>; required?: string[] };
  } | null = null;

  client.setRequestHandler(ElicitRequestSchema, async (request) => {
    const params = extractElicitPayload(request as unknown);

    requestSeen = params;

    return {
      action: "accept",
      content: {
        deployment: "None of the above",
        deployment__note: "Need hybrid deployment.",
      },
    };
  });

  const transport = new StdioClientTransport({
    command: launch.command,
    args: launch.args,
    env: {
      ...process.env,
      ...launch.env,
      GWD_HOME: isolatedGsdHome,
      DISCORD_BOT_TOKEN: "",
      SLACK_BOT_TOKEN: "",
      TELEGRAM_BOT_TOKEN: "",
    } as Record<string, string>,
    cwd: launch.cwd,
    stderr: "pipe",
  });

  try {
    await client.connect(transport, { timeout: 30_000 });

    const result = await client.callTool(
      {
        name: "ask_user_questions",
        arguments: {
          questions: [
            {
              id: "deployment",
              header: "Deploy",
              question: "Where will this run?",
              options: [
                { label: "Cloud", description: "Managed hosting." },
                { label: "On-prem", description: "Runs in customer infrastructure." },
              ],
            },
          ],
        },
      },
      undefined,
      { timeout: 30_000 },
    );

    assert.ok(requestSeen, "expected stdio transport to forward an elicitation request");
    const seen = requestSeen as ElicitPayload;
    assert.match(seen.message, /Please answer the following question/);
    assert.ok(seen.requestedSchema.properties.deployment);
    assert.ok(seen.requestedSchema.properties.deployment__note);
    assert.ok(seen.requestedSchema.required?.includes("deployment"));

    const content = (result as { content: Array<{ type: string; text?: string }> }).content;
    const text = content.find((item: { type: string; text?: string }) => item.type === "text");
    assert.ok(text && "text" in text);
    assert.equal(
      text.text,
      JSON.stringify({
        answers: {
          deployment: {
            answers: ["None of the above", "user_note: Need hybrid deployment."],
          },
        },
      }),
    );
  } finally {
    await client.close();
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(isolatedGsdHome, { recursive: true, force: true });
  }
});

test("usesWorkflowMcpTransport matches local externalCli providers", () => {
  assert.equal(usesWorkflowMcpTransport("externalCli", "local://claude-code"), true);
  assert.equal(usesWorkflowMcpTransport("externalCli", "https://api.example.com"), false);
  assert.equal(usesWorkflowMcpTransport("oauth", "local://custom"), false);
});

test("supportsStructuredQuestions disables local workflow MCP questions unless explicitly enabled", () => {
  assert.equal(
    supportsStructuredQuestions(["ask_user_questions"], {
      authMode: "externalCli",
      baseUrl: "local://claude-code",
      env: {},
    }),
    false,
  );
  assert.equal(
    supportsStructuredQuestions(["mcp__gwd-workflow__ask_user_questions"], {
      authMode: "externalCli",
      baseUrl: "local://claude-code",
      env: { GWD_WORKFLOW_MCP_STRUCTURED_QUESTIONS: "1" } as NodeJS.ProcessEnv,
    }),
    true,
  );
  assert.equal(
    supportsStructuredQuestions(["ask_user_questions"], {
      authMode: "oauth",
      baseUrl: "https://api.anthropic.com",
    }),
    true,
  );
  assert.equal(
    supportsStructuredQuestions([], {
      authMode: "oauth",
      baseUrl: "https://api.anthropic.com",
    }),
    false,
  );
});

test("transport compatibility passes when required tools fit current MCP surface", () => {
  const error = getWorkflowTransportSupportError(
    "claude-code",
    ["gwd_task_complete"],
    {
      projectRoot: "/tmp/project",
      env: { GWD_WORKFLOW_MCP_COMMAND: "node" },
      surface: "guided flow",
      unitType: "execute-task",
      authMode: "externalCli",
      baseUrl: "local://claude-code",
    },
  );

  assert.equal(error, null);
});

test("transport compatibility discovers the bundled MCP server without env overrides", () => {
  const error = getWorkflowTransportSupportError(
    "claude-code",
    ["gwd_task_complete"],
    {
      projectRoot: "/tmp/project",
      env: {},
      surface: "auto-mode",
      unitType: "execute-task",
      authMode: "externalCli",
      baseUrl: "local://claude-code",
    },
  );

  assert.equal(error, null);
});

test("transport compatibility now allows auto execute-task over workflow MCP surface", () => {
  const error = getWorkflowTransportSupportError(
    "claude-code",
    ["gwd_task_complete"],
    {
      projectRoot: "/tmp/project",
      env: { GWD_WORKFLOW_MCP_COMMAND: "node" },
      surface: "auto-mode",
      unitType: "execute-task",
      authMode: "externalCli",
      baseUrl: "local://claude-code",
    },
  );

  assert.equal(error, null);
});

test("transport compatibility ignores API-backed providers", () => {
  const error = getWorkflowTransportSupportError(
    "openai-codex",
    ["gwd_plan_slice"],
    {
      projectRoot: "/tmp/project",
      env: {},
      surface: "auto-mode",
      unitType: "plan-slice",
      authMode: "oauth",
      baseUrl: "https://api.openai.com",
    },
  );

  assert.equal(error, null);
});

test("transport compatibility now allows plan-slice over workflow MCP surface", () => {
  const error = getWorkflowTransportSupportError(
    "claude-code",
    ["gwd_plan_slice"],
    {
      projectRoot: "/tmp/project",
      env: { GWD_WORKFLOW_MCP_COMMAND: "node" },
      surface: "auto-mode",
      unitType: "plan-slice",
      authMode: "externalCli",
      baseUrl: "local://claude-code",
    },
  );

  assert.equal(error, null);
});

test("transport compatibility now allows complete-slice over workflow MCP surface", () => {
  const error = getWorkflowTransportSupportError(
    "claude-code",
    ["gwd_slice_complete"],
    {
      projectRoot: "/tmp/project",
      env: { GWD_WORKFLOW_MCP_COMMAND: "node" },
      surface: "auto-mode",
      unitType: "complete-slice",
      authMode: "externalCli",
      baseUrl: "local://claude-code",
    },
  );

  assert.equal(error, null);
});

test("transport compatibility now allows reassess-roadmap over workflow MCP surface", () => {
  const error = getWorkflowTransportSupportError(
    "claude-code",
    ["gwd_milestone_status", "gwd_reassess_roadmap"],
    {
      projectRoot: "/tmp/project",
      env: { GWD_WORKFLOW_MCP_COMMAND: "node" },
      surface: "auto-mode",
      unitType: "reassess-roadmap",
      authMode: "externalCli",
      baseUrl: "local://claude-code",
    },
  );

  assert.equal(error, null);
});

test("transport compatibility now allows gate-evaluate over workflow MCP surface", () => {
  const error = getWorkflowTransportSupportError(
    "claude-code",
    ["gwd_save_gate_result"],
    {
      projectRoot: "/tmp/project",
      env: { GWD_WORKFLOW_MCP_COMMAND: "node" },
      surface: "auto-mode",
      unitType: "gate-evaluate",
      authMode: "externalCli",
      baseUrl: "local://claude-code",
    },
  );

  assert.equal(error, null);
});

test("transport compatibility now allows validate-milestone over workflow MCP surface", () => {
  const error = getWorkflowTransportSupportError(
    "claude-code",
    ["gwd_milestone_status", "gwd_validate_milestone"],
    {
      projectRoot: "/tmp/project",
      env: { GWD_WORKFLOW_MCP_COMMAND: "node" },
      surface: "auto-mode",
      unitType: "validate-milestone",
      authMode: "externalCli",
      baseUrl: "local://claude-code",
    },
  );

  assert.equal(error, null);
});

test("transport compatibility now allows complete-milestone over workflow MCP surface", () => {
  const error = getWorkflowTransportSupportError(
    "claude-code",
    ["gwd_milestone_status", "gwd_complete_milestone"],
    {
      projectRoot: "/tmp/project",
      env: { GWD_WORKFLOW_MCP_COMMAND: "node" },
      surface: "auto-mode",
      unitType: "complete-milestone",
      authMode: "externalCli",
      baseUrl: "local://claude-code",
    },
  );

  assert.equal(error, null);
});

test("transport compatibility now allows replan-slice over workflow MCP surface", () => {
  const error = getWorkflowTransportSupportError(
    "claude-code",
    ["gwd_replan_slice"],
    {
      projectRoot: "/tmp/project",
      env: { GWD_WORKFLOW_MCP_COMMAND: "node" },
      surface: "auto-mode",
      unitType: "replan-slice",
      authMode: "externalCli",
      baseUrl: "local://claude-code",
    },
  );

  assert.equal(error, null);
});

test("transport compatibility still blocks units whose MCP tools are not exposed", () => {
  const error = getWorkflowTransportSupportError(
    "claude-code",
    ["secure_env_collect"],
    {
      projectRoot: "/tmp/project",
      env: { GWD_WORKFLOW_MCP_COMMAND: "node" },
      surface: "auto-mode",
      unitType: "guided-discussion",
      authMode: "externalCli",
      baseUrl: "local://claude-code",
    },
  );

  assert.match(error ?? "", /requires secure_env_collect/);
  assert.match(error ?? "", /currently exposes only/);
});
