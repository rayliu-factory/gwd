import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface WorkflowMcpLaunchConfig {
  name: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface WorkflowCapabilityOptions {
  projectRoot?: string;
  env?: NodeJS.ProcessEnv;
  surface?: string;
  unitType?: string;
  authMode?: "apiKey" | "oauth" | "externalCli" | "none";
  baseUrl?: string;
}

const MCP_WORKFLOW_TOOL_SURFACE = new Set([
  "ask_user_questions",
  "gwd_decision_save",
  "gwd_exec",
  "gwd_exec_search",
  "gwd_resume",
  "gwd_complete_milestone",
  "gwd_journal_query",
  "gwd_milestone_generate_id",
  "gwd_milestone_reopen",
  "gwd_checkpoint_db",
  "gwd_milestone_status",
  "gwd_plan_task",
  "gwd_plan_milestone",
  "gwd_plan_slice",
  "gwd_replan_slice",
  "gwd_reassess_roadmap",
  "gwd_reopen_milestone",
  "gwd_reopen_slice",
  "gwd_reopen_task",
  "gwd_requirement_save",
  "gwd_requirement_update",
  "gwd_save_gate_result",
  "gwd_skip_slice",
  "gwd_slice_complete",
  "gwd_slice_reopen",
  "gwd_summary_save",
  "gwd_task_complete",
  "gwd_task_reopen",
  "gwd_validate_milestone",
]);

function parseLookupOutput(output: Buffer | string): string {
  return output
    .toString()
    .trim()
    .split(/\r?\n/)[0] ?? "";
}

function parseJsonEnv<T>(env: NodeJS.ProcessEnv, name: string): T | undefined {
  const raw = env[name];
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Invalid JSON in ${name}`);
  }
}

function lookupCommand(command: string, platform: NodeJS.Platform = process.platform): string | null {
  const lookup = platform === "win32" ? `where ${command}` : `which ${command}`;
  try {
    const resolved = parseLookupOutput(execSync(lookup, { timeout: 5_000, stdio: "pipe" }));
    return resolved || null;
  } catch {
    return null;
  }
}

function findWorkflowCliFromAncestorPath(startPath: string): string | null {
  let current = resolve(startPath);

  while (true) {
    const candidate = resolve(current, "packages", "mcp-server", "dist", "cli.js");
    if (existsSync(candidate)) return candidate;

    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

function getBundledWorkflowMcpCliPath(env: NodeJS.ProcessEnv): string | null {
  const envAnchors = [
    env.GWD_BIN_PATH?.trim(),
    env.GWD_CLI_PATH?.trim(),
    env.GWD_WORKFLOW_PATH?.trim(),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  for (const anchor of envAnchors) {
    const candidate = findWorkflowCliFromAncestorPath(anchor);
    if (candidate) return candidate;
  }

  const candidates = [
    resolve(fileURLToPath(new URL("../../../../packages/mcp-server/src/cli.ts", import.meta.url))),
    resolve(fileURLToPath(new URL("../../../../../packages/mcp-server/src/cli.ts", import.meta.url))),
    resolve(fileURLToPath(new URL("../../../../packages/mcp-server/dist/cli.js", import.meta.url))),
    resolve(fileURLToPath(new URL("../../../../../packages/mcp-server/dist/cli.js", import.meta.url))),
  ];

  for (const bundledCli of candidates) {
    if (existsSync(bundledCli)) return bundledCli;
  }

  return null;
}

function getBundledWorkflowExecutorModulePath(): string | null {
  const candidates = [
    resolve(fileURLToPath(new URL("./tools/workflow-tool-executors.js", import.meta.url))),
    resolve(fileURLToPath(new URL("./tools/workflow-tool-executors.ts", import.meta.url))),
    resolve(fileURLToPath(new URL("../../../../dist/resources/extensions/gwd/tools/workflow-tool-executors.js", import.meta.url))),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function getBundledWorkflowWriteGateModulePath(): string | null {
  const candidates = [
    resolve(fileURLToPath(new URL("./bootstrap/write-gate.js", import.meta.url))),
    resolve(fileURLToPath(new URL("./bootstrap/write-gate.ts", import.meta.url))),
    resolve(fileURLToPath(new URL("../../../../dist/resources/extensions/gwd/bootstrap/write-gate.js", import.meta.url))),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function getResolveTsHookPath(): string | null {
  const candidates = [
    resolve(fileURLToPath(new URL("./tests/resolve-ts.mjs", import.meta.url))),
    resolve(fileURLToPath(new URL("../../../../src/resources/extensions/gwd/tests/resolve-ts.mjs", import.meta.url))),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function mergeNodeOptions(existing: string | undefined, additions: string[]): string | undefined {
  const tokens = (existing ?? "").split(/\s+/).map((value) => value.trim()).filter(Boolean);
  for (const addition of additions) {
    if (!tokens.includes(addition)) {
      tokens.push(addition);
    }
  }
  return tokens.length > 0 ? tokens.join(" ") : undefined;
}

function buildWorkflowLaunchEnv(
  projectRoot: string,
  gsdCliPath: string | undefined,
  explicitEnv?: Record<string, string>,
  workflowCliPath?: string,
): Record<string, string> {
  const executorModulePath = getBundledWorkflowExecutorModulePath();
  const writeGateModulePath = getBundledWorkflowWriteGateModulePath();
  const resolveTsHookPath = getResolveTsHookPath();
  const wantsSourceTs =
    Boolean(resolveTsHookPath) &&
    (
      (workflowCliPath?.endsWith(".ts") ?? false) ||
      (executorModulePath?.endsWith(".ts") ?? false) ||
      (writeGateModulePath?.endsWith(".ts") ?? false)
    );
  const nodeOptions = wantsSourceTs
    ? mergeNodeOptions(explicitEnv?.NODE_OPTIONS, [
        "--experimental-strip-types",
        `--import=${pathToFileURL(resolveTsHookPath!).href}`,
      ])
    : explicitEnv?.NODE_OPTIONS;

  return {
    ...(explicitEnv ?? {}),
    ...(gsdCliPath ? { GWD_CLI_PATH: gsdCliPath, GWD_BIN_PATH: gsdCliPath } : {}),
    ...(executorModulePath ? { GWD_WORKFLOW_EXECUTORS_MODULE: executorModulePath } : {}),
    ...(writeGateModulePath ? { GWD_WORKFLOW_WRITE_GATE_MODULE: writeGateModulePath } : {}),
    ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
    GWD_PERSIST_WRITE_GATE_STATE: "1",
    GWD_WORKFLOW_PROJECT_ROOT: projectRoot,
  };
}

export function detectWorkflowMcpLaunchConfig(
  projectRoot = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): WorkflowMcpLaunchConfig | null {
  const name = env.GWD_WORKFLOW_MCP_NAME?.trim() || "gwd-workflow";
  const explicitCommand = env.GWD_WORKFLOW_MCP_COMMAND?.trim();
  const explicitArgs = parseJsonEnv<unknown>(env, "GWD_WORKFLOW_MCP_ARGS");
  const explicitEnv = parseJsonEnv<Record<string, string>>(env, "GWD_WORKFLOW_MCP_ENV");
  const explicitCwd = env.GWD_WORKFLOW_MCP_CWD?.trim();
  const gsdCliPath =
    explicitEnv?.GWD_CLI_PATH?.trim()
    || explicitEnv?.GWD_BIN_PATH?.trim()
    || env.GWD_CLI_PATH?.trim()
    || env.GWD_BIN_PATH?.trim();
  const workflowProjectRoot =
    explicitEnv?.GWD_WORKFLOW_PROJECT_ROOT?.trim() ||
    env.GWD_WORKFLOW_PROJECT_ROOT?.trim() ||
    env.GWD_PROJECT_ROOT?.trim() ||
    explicitCwd ||
    projectRoot;
  const resolvedWorkflowProjectRoot = resolve(workflowProjectRoot);

  if (explicitCommand) {
    const launchEnv = buildWorkflowLaunchEnv(resolve(workflowProjectRoot), gsdCliPath, explicitEnv);
    return {
      name,
      command: explicitCommand,
      args: Array.isArray(explicitArgs) && explicitArgs.length > 0 ? explicitArgs.map(String) : undefined,
      cwd: explicitCwd || undefined,
      env: Object.keys(launchEnv).length > 0 ? launchEnv : undefined,
    };
  }

  const distCli = resolve(resolvedWorkflowProjectRoot, "packages", "mcp-server", "dist", "cli.js");
  if (existsSync(distCli)) {
    return {
      name,
      command: process.execPath,
      args: [distCli],
      cwd: resolvedWorkflowProjectRoot,
      env: buildWorkflowLaunchEnv(resolvedWorkflowProjectRoot, gsdCliPath, undefined, distCli),
    };
  }

  const bundledCli = getBundledWorkflowMcpCliPath(env);
  if (bundledCli) {
    return {
      name,
      command: process.execPath,
      args: [bundledCli],
      cwd: resolvedWorkflowProjectRoot,
      env: buildWorkflowLaunchEnv(resolvedWorkflowProjectRoot, gsdCliPath, undefined, bundledCli),
    };
  }

  const binPath = lookupCommand("gwd-mcp-server");
  if (binPath) {
    return {
      name,
      command: binPath,
      env: buildWorkflowLaunchEnv(resolvedWorkflowProjectRoot, gsdCliPath),
    };
  }

  return null;
}

export function buildWorkflowMcpServers(
  projectRoot = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): Record<string, Record<string, unknown>> | undefined {
  const launch = detectWorkflowMcpLaunchConfig(projectRoot, env);
  if (!launch) return undefined;

  return {
    [launch.name]: {
      command: launch.command,
      ...(launch.args && launch.args.length > 0 ? { args: launch.args } : {}),
      ...(launch.env ? { env: launch.env } : {}),
      ...(launch.cwd ? { cwd: launch.cwd } : {}),
    },
  };
}

export function getRequiredWorkflowToolsForGuidedUnit(unitType: string): string[] {
  switch (unitType) {
    case "discuss-project":
      return ["ask_user_questions", "gwd_summary_save"];
    case "discuss-requirements":
      return ["ask_user_questions", "gwd_requirement_save", "gwd_summary_save"];
    case "research-decision":
      return ["ask_user_questions"];
    case "discuss-milestone":
      return ["gwd_summary_save", "gwd_plan_milestone"];
    case "discuss-slice":
      return ["gwd_summary_save"];
    case "research-milestone":
    case "research-slice":
      return ["gwd_summary_save"];
    case "plan-milestone":
      return ["gwd_plan_milestone"];
    case "plan-slice":
      return ["gwd_plan_slice"];
    case "execute-task":
      return ["gwd_task_complete"];
    case "complete-slice":
      return ["gwd_slice_complete"];
    default:
      return [];
  }
}

export function getRequiredWorkflowToolsForAutoUnit(unitType: string): string[] {
  switch (unitType) {
    case "discuss-project":
      return ["ask_user_questions", "gwd_summary_save"];
    case "discuss-requirements":
      return ["ask_user_questions", "gwd_requirement_save", "gwd_summary_save"];
    case "research-decision":
      return ["ask_user_questions"];
    case "discuss-milestone":
      return ["gwd_summary_save", "gwd_plan_milestone"];
    case "research-milestone":
    case "research-slice":
    case "run-uat":
      return ["gwd_summary_save"];
    case "plan-milestone":
      return ["gwd_plan_milestone"];
    case "plan-slice":
      return ["gwd_plan_slice"];
    case "execute-task":
    case "execute-task-simple":
    case "reactive-execute":
      return ["gwd_task_complete"];
    case "complete-slice":
      return ["gwd_slice_complete"];
    case "replan-slice":
      return ["gwd_replan_slice"];
    case "reassess-roadmap":
      return ["gwd_milestone_status", "gwd_reassess_roadmap"];
    case "gate-evaluate":
      return ["gwd_save_gate_result"];
    case "validate-milestone":
      return ["gwd_milestone_status", "gwd_validate_milestone"];
    case "complete-milestone":
      return ["gwd_milestone_status", "gwd_complete_milestone"];
    default:
      return [];
  }
}

export function usesWorkflowMcpTransport(
  authMode: WorkflowCapabilityOptions["authMode"],
  baseUrl: string | undefined,
): boolean {
  return authMode === "externalCli" && typeof baseUrl === "string" && baseUrl.startsWith("local://");
}

function hasAskUserQuestionsTool(activeTools: string[]): boolean {
  return activeTools.some((toolName) => {
    if (toolName === "ask_user_questions") return true;
    if (!toolName.startsWith("mcp__")) return false;
    const toolSeparator = toolName.indexOf("__", "mcp__".length);
    return toolSeparator >= 0 && toolName.slice(toolSeparator + 2) === "ask_user_questions";
  });
}

function workflowMcpStructuredQuestionsOptIn(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.GWD_WORKFLOW_MCP_STRUCTURED_QUESTIONS;
  return value === "1" || value === "true";
}

export function supportsStructuredQuestions(
  activeTools: string[],
  options: Pick<WorkflowCapabilityOptions, "authMode" | "baseUrl" | "env"> = {},
): boolean {
  if (!hasAskUserQuestionsTool(activeTools)) return false;
  if (usesWorkflowMcpTransport(options.authMode, options.baseUrl)) {
    // Claude Code local workflow-MCP exposes ask_user_questions, but form
    // elicitation can return an immediate cancel outside GWD's chat turn. Keep
    // checkpoints in plain chat unless a caller deliberately opts into testing
    // that transport.
    return workflowMcpStructuredQuestionsOptIn(options.env);
  }

  return true;
}

export function getWorkflowTransportSupportError(
  provider: string | undefined,
  requiredTools: string[],
  options: WorkflowCapabilityOptions = {},
): string | null {
  if (!provider || requiredTools.length === 0) return null;
  if (!usesWorkflowMcpTransport(options.authMode, options.baseUrl)) return null;

  const projectRoot = options.projectRoot ?? process.cwd();
  const env = options.env ?? process.env;
  const launch = detectWorkflowMcpLaunchConfig(projectRoot, env);
  const surface = options.surface ?? "workflow dispatch";
  const unitLabel = options.unitType ? ` for ${options.unitType}` : "";
  const providerLabel = `"${provider}"`;

  if (!launch) {
    return `Provider ${providerLabel} cannot run ${surface}${unitLabel}: the GWD workflow MCP server is not configured or discoverable. Detected Claude Code model but no workflow MCP. Please run /gwd mcp init . from your project root. You can also configure GWD_WORKFLOW_MCP_COMMAND, build packages/mcp-server/dist/cli.js, or install gwd-mcp-server on PATH.`;
  }

  const missing = [...new Set(requiredTools)].filter((tool) => !MCP_WORKFLOW_TOOL_SURFACE.has(tool));
  if (missing.length === 0) return null;

  return `Provider ${providerLabel} cannot run ${surface}${unitLabel}: this unit requires ${missing.join(", ")}, but the workflow MCP transport currently exposes only ${Array.from(MCP_WORKFLOW_TOOL_SURFACE).sort().join(", ")}.`;
}
