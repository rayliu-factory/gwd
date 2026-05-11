// Project/App: GWD-2
// File Purpose: Custom-engine iteration-data adapter for auto-mode loop.

import type { GWDState } from "../types.js";
import type { IterationData } from "./types.js";

export interface CustomEngineStep {
  unitType: string;
  unitId: string;
  prompt: string;
}

export interface BuildCustomEngineIterationDataInput {
  step: CustomEngineStep;
  basePath: string;
  canonicalProjectRoot: string;
  currentMilestoneId?: string | null;
  deriveState: (basePath: string) => Promise<GWDState>;
  logPostDerive: (details: {
    site: "custom-engine-gwd-state";
    basePath: string;
    canonicalProjectRoot: string;
    derivedPhase: GWDState["phase"];
    activeUnit: string | undefined;
  }) => void;
}

export async function buildCustomEngineIterationData(
  input: BuildCustomEngineIterationDataInput,
): Promise<IterationData> {
  const gwdState = await input.deriveState(input.canonicalProjectRoot);
  input.logPostDerive({
    site: "custom-engine-gwd-state",
    basePath: input.basePath,
    canonicalProjectRoot: input.canonicalProjectRoot,
    derivedPhase: gwdState.phase,
    activeUnit: gwdState.activeTask?.id ?? gwdState.activeSlice?.id ?? gwdState.activeMilestone?.id,
  });

  return {
    unitType: input.step.unitType,
    unitId: input.step.unitId,
    prompt: input.step.prompt,
    finalPrompt: input.step.prompt,
    pauseAfterUatDispatch: false,
    state: gwdState,
    mid: input.currentMilestoneId ?? "workflow",
    midTitle: "Workflow",
    isRetry: false,
    previousTier: undefined,
  };
}
