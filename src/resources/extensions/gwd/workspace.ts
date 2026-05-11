// GWD-2 + Workspace handle: single source of truth for path resolution per milestone

import { join, resolve } from "node:path";
import { type GwdPathContract, resolveGwdPathContract, normalizeRealPath } from "./paths.js";
import { isGwdWorktreePath, resolveWorktreeProjectRoot } from "./worktree-root.js";

export type GwdWorkspaceMode = "project" | "worktree";

export interface GwdWorkspace {
  readonly projectRoot: string;          // realpath-normalized absolute
  readonly worktreeRoot: string | null;  // realpath-normalized absolute, null when no worktree
  readonly mode: GwdWorkspaceMode;
  readonly contract: GwdPathContract;    // pre-resolved, frozen
  readonly identityKey: string;          // canonical key (realpath of projectRoot) for dedup/cache
  readonly lockRoot: string;             // where auto.lock and {MID}-META.json live (always projectRoot)
}

export interface MilestoneScope {
  readonly workspace: GwdWorkspace;
  readonly milestoneId: string;
  // path methods:
  readonly contextFile: () => string;
  readonly roadmapFile: () => string;
  readonly stateFile: () => string;
  readonly dbPath: () => string;
  readonly milestoneDir: () => string;
  readonly metaJson: () => string;       // {MID}-META.json on lockRoot
}

function tryRealpath(p: string): string {
  return normalizeRealPath(p);
}

/**
 * Create an immutable GwdWorkspace handle from a raw base path.
 * Resolves both the project root and (when applicable) the worktree root,
 * normalizes them via realpath, and freezes the result.
 */
export function createWorkspace(rawBasePath: string): GwdWorkspace {
  const resolvedBase = resolve(rawBasePath);
  const isWorktree = isGwdWorktreePath(resolvedBase);

  const projectRootRaw = resolveWorktreeProjectRoot(resolvedBase);
  const projectRoot = tryRealpath(resolve(projectRootRaw));

  const worktreeRoot = isWorktree ? tryRealpath(resolvedBase) : null;

  // Derive a canonical base from the already-realpath-normalized paths so that
  // resolveGwdPathContract always receives a canonical path. Using the raw
  // resolvedBase here can produce a non-canonical projectGwd when the input
  // path contains symlinks, causing contract.projectGwd to diverge from the
  // realpath-normalized projectRoot / identityKey.
  const canonicalBase = isWorktree ? (worktreeRoot ?? resolvedBase) : projectRoot;
  const contract = Object.freeze(resolveGwdPathContract(canonicalBase));

  const identityKey = tryRealpath(projectRoot);

  const mode: GwdWorkspaceMode = isWorktree ? "worktree" : "project";

  const workspace: GwdWorkspace = Object.freeze({
    projectRoot,
    worktreeRoot,
    mode,
    contract,
    identityKey,
    lockRoot: projectRoot,
  });

  return workspace;
}

/**
 * Bind a milestoneId to a workspace, producing an immutable MilestoneScope
 * with path-returning closures that resolve via the authoritative projectGwd.
 *
 * All milestone-content paths route to contract.projectGwd (canonical),
 * since that is the authoritative source of truth regardless of worktree mode.
 */
export function scopeMilestone(workspace: GwdWorkspace, milestoneId: string): MilestoneScope {
  const { contract } = workspace;
  const gwd = contract.projectGwd;

  const scope: MilestoneScope = Object.freeze({
    workspace,
    milestoneId,
    contextFile: () => join(gwd, "milestones", milestoneId, `${milestoneId}-CONTEXT.md`),
    roadmapFile: () => join(gwd, "milestones", milestoneId, `${milestoneId}-ROADMAP.md`),
    stateFile: () => join(gwd, "STATE.md"),
    dbPath: () => contract.projectDb,
    milestoneDir: () => join(gwd, "milestones", milestoneId),
    metaJson: () => join(gwd, `${milestoneId}-META.json`),
  });

  return scope;
}
