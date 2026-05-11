/**
 * dev-workflow-engine.ts — DevWorkflowEngine implementation.
 *
 * Implements WorkflowEngine by delegating to existing GWD state derivation
 * and dispatch logic. This is the "dev" engine — it wraps the current GWD
 * auto-mode behavior behind the engine-polymorphic interface.
 */

import type { WorkflowEngine } from "./workflow-engine.js";
import type {
  EngineState,
  EngineDispatchAction,
  CompletedStep,
  ReconcileResult,
  DisplayMetadata,
} from "./engine-types.js";
import type { GWDState } from "./types.js";
import type { DispatchAction, DispatchContext } from "./auto-dispatch.js";

import { deriveState } from "./state.js";
import { resolveDispatch } from "./auto-dispatch.js";
import { loadEffectiveGWDPreferences } from "./preferences.js";

// ─── Bridge: DispatchAction → EngineDispatchAction ────────────────────────

/**
 * Map a GWD-specific DispatchAction (which carries `matchedRule`, `unitType`,
 * etc.) to the engine-generic EngineDispatchAction discriminated union.
 *
 * Exported for unit testing.
 */
export function bridgeDispatchAction(da: DispatchAction): EngineDispatchAction {
  switch (da.action) {
    case "dispatch":
      return {
        action: "dispatch",
        step: {
          unitType: da.unitType,
          unitId: da.unitId,
          prompt: da.prompt,
        },
      };
    case "stop":
      return {
        action: "stop",
        reason: da.reason,
        level: da.level,
      };
    case "skip":
      return { action: "skip" };
  }
}

// ─── DevWorkflowEngine ───────────────────────────────────────────────────

export class DevWorkflowEngine implements WorkflowEngine {
  readonly engineId = "dev" as const;

  async deriveState(basePath: string): Promise<EngineState> {
    const gwd: GWDState = await deriveState(basePath);
    return {
      phase: gwd.phase,
      currentMilestoneId: gwd.activeMilestone?.id ?? null,
      activeSliceId: gwd.activeSlice?.id ?? null,
      activeTaskId: gwd.activeTask?.id ?? null,
      isComplete: gwd.phase === "complete",
      raw: gwd,
    };
  }

  async resolveDispatch(
    state: EngineState,
    context: { basePath: string },
  ): Promise<EngineDispatchAction> {
    const gwd = state.raw as GWDState;
    const mid = gwd.activeMilestone?.id ?? "";
    const midTitle = gwd.activeMilestone?.title ?? "";
    const loaded = loadEffectiveGWDPreferences();
    const prefs = loaded?.preferences ?? undefined;

    const dispatchCtx: DispatchContext = {
      basePath: context.basePath,
      mid,
      midTitle,
      state: gwd,
      prefs,
    };

    const result = await resolveDispatch(dispatchCtx);
    return bridgeDispatchAction(result);
  }

  async reconcile(
    state: EngineState,
    _completedStep: CompletedStep,
  ): Promise<ReconcileResult> {
    return {
      outcome: state.isComplete ? "milestone-complete" : "continue",
    };
  }

  getDisplayMetadata(state: EngineState): DisplayMetadata {
    return {
      engineLabel: "GWD Dev",
      currentPhase: state.phase,
      progressSummary: `${state.currentMilestoneId ?? "no milestone"} / ${state.activeSliceId ?? "—"} / ${state.activeTaskId ?? "—"}`,
      stepCount: null,
    };
  }
}
