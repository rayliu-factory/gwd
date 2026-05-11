// Project/App: GWD
// File Purpose: Canonical workflow MCP tool metadata shared across package boundaries.

export type WorkflowToolWritePolicy = "read" | "write";

export interface WorkflowToolContractMetadata {
	canonicalName: string;
	aliases: readonly string[];
	schemaId: string;
	executorId: string;
	writePolicy: WorkflowToolWritePolicy;
	auditEvent: string;
}

export const WORKFLOW_TOOL_CONTRACTS = [
	{
		canonicalName: "gwd_decision_save",
		aliases: [],
		schemaId: "workflow.decision.save",
		executorId: "executeDecisionSave",
		writePolicy: "write",
		auditEvent: "workflow.decision.save",
	},
	{
		canonicalName: "gwd_requirement_update",
		aliases: [],
		schemaId: "workflow.requirement.update",
		executorId: "executeRequirementUpdate",
		writePolicy: "write",
		auditEvent: "workflow.requirement.update",
	},
	{
		canonicalName: "gwd_requirement_save",
		aliases: [],
		schemaId: "workflow.requirement.save",
		executorId: "executeRequirementSave",
		writePolicy: "write",
		auditEvent: "workflow.requirement.save",
	},
	{
		canonicalName: "gwd_milestone_generate_id",
		aliases: [],
		schemaId: "workflow.milestone.generate_id",
		executorId: "executeMilestoneGenerateId",
		writePolicy: "read",
		auditEvent: "workflow.milestone.generate_id",
	},
	{
		canonicalName: "gwd_plan_milestone",
		aliases: [],
		schemaId: "workflow.milestone.plan",
		executorId: "executePlanMilestone",
		writePolicy: "write",
		auditEvent: "workflow.milestone.plan",
	},
	{
		canonicalName: "gwd_plan_slice",
		aliases: [],
		schemaId: "workflow.slice.plan",
		executorId: "executePlanSlice",
		writePolicy: "write",
		auditEvent: "workflow.slice.plan",
	},
	{
		canonicalName: "gwd_plan_task",
		aliases: [],
		schemaId: "workflow.task.plan",
		executorId: "executePlanTask",
		writePolicy: "write",
		auditEvent: "workflow.task.plan",
	},
	{
		canonicalName: "gwd_replan_slice",
		aliases: [],
		schemaId: "workflow.slice.replan",
		executorId: "executeReplanSlice",
		writePolicy: "write",
		auditEvent: "workflow.slice.replan",
	},
	{
		canonicalName: "gwd_slice_complete",
		aliases: [],
		schemaId: "workflow.slice.complete",
		executorId: "executeSliceComplete",
		writePolicy: "write",
		auditEvent: "workflow.slice.complete",
	},
	{
		canonicalName: "gwd_skip_slice",
		aliases: [],
		schemaId: "workflow.slice.skip",
		executorId: "executeSkipSlice",
		writePolicy: "write",
		auditEvent: "workflow.slice.skip",
	},
	{
		canonicalName: "gwd_complete_milestone",
		aliases: [],
		schemaId: "workflow.milestone.complete",
		executorId: "executeCompleteMilestone",
		writePolicy: "write",
		auditEvent: "workflow.milestone.complete",
	},
	{
		canonicalName: "gwd_validate_milestone",
		aliases: [],
		schemaId: "workflow.milestone.validate",
		executorId: "executeValidateMilestone",
		writePolicy: "write",
		auditEvent: "workflow.milestone.validate",
	},
	{
		canonicalName: "gwd_reassess_roadmap",
		aliases: [],
		schemaId: "workflow.roadmap.reassess",
		executorId: "executeReassessRoadmap",
		writePolicy: "write",
		auditEvent: "workflow.roadmap.reassess",
	},
	{
		canonicalName: "gwd_save_gate_result",
		aliases: [],
		schemaId: "workflow.gate.save_result",
		executorId: "executeSaveGateResult",
		writePolicy: "write",
		auditEvent: "workflow.gate.save_result",
	},
	{
		canonicalName: "gwd_summary_save",
		aliases: [],
		schemaId: "workflow.summary.save",
		executorId: "executeSummarySave",
		writePolicy: "write",
		auditEvent: "workflow.summary.save",
	},
	{
		canonicalName: "gwd_task_complete",
		aliases: [],
		schemaId: "workflow.task.complete",
		executorId: "executeTaskComplete",
		writePolicy: "write",
		auditEvent: "workflow.task.complete",
	},
	{
		canonicalName: "gwd_milestone_status",
		aliases: [],
		schemaId: "workflow.milestone.status",
		executorId: "executeMilestoneStatus",
		writePolicy: "read",
		auditEvent: "workflow.milestone.status",
	},
	{
		canonicalName: "gwd_journal_query",
		aliases: [],
		schemaId: "workflow.journal.query",
		executorId: "executeJournalQuery",
		writePolicy: "read",
		auditEvent: "workflow.journal.query",
	},
	{
		canonicalName: "gwd_exec",
		aliases: [],
		schemaId: "workflow.exec.run",
		executorId: "executeGwdExec",
		writePolicy: "write",
		auditEvent: "workflow.exec.run",
	},
	{
		canonicalName: "gwd_exec_search",
		aliases: [],
		schemaId: "workflow.exec.search",
		executorId: "executeGwdExecSearch",
		writePolicy: "read",
		auditEvent: "workflow.exec.search",
	},
	{
		canonicalName: "gwd_resume",
		aliases: [],
		schemaId: "workflow.resume",
		executorId: "executeGwdResume",
		writePolicy: "read",
		auditEvent: "workflow.resume",
	},
	{
		canonicalName: "gwd_capture_thought",
		aliases: [],
		schemaId: "workflow.memory.capture_thought",
		executorId: "executeCaptureThought",
		writePolicy: "write",
		auditEvent: "workflow.memory.capture_thought",
	},
	{
		canonicalName: "gwd_memory_query",
		aliases: [],
		schemaId: "workflow.memory.query",
		executorId: "executeMemoryQuery",
		writePolicy: "read",
		auditEvent: "workflow.memory.query",
	},
	{
		canonicalName: "gwd_memory_graph",
		aliases: [],
		schemaId: "workflow.memory.graph",
		executorId: "executeMemoryGraph",
		writePolicy: "read",
		auditEvent: "workflow.memory.graph",
	},
] as const satisfies readonly WorkflowToolContractMetadata[];

export const WORKFLOW_TOOL_NAMES = WORKFLOW_TOOL_CONTRACTS.flatMap((tool) => [
	tool.canonicalName,
	...tool.aliases,
]) as readonly string[];
