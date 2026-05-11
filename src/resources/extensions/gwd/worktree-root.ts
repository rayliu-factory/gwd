import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { gsdHome } from "./gwd-home.js";

export interface WorktreeSegment {
  gwdIdx: number;
  afterWorktrees: number;
}

export function normalizeWorktreePathForCompare(path: string): string {
  let normalized: string;
  try {
    normalized = realpathSync(path);
  } catch {
    normalized = resolve(path);
  }
  const slashed = normalized.replaceAll("\\", "/");
  const trimmed = slashed.replace(/\/+$/, "");
  return process.platform === "win32" ? (trimmed || "/").toLowerCase() : (trimmed || "/");
}

/**
 * Find the GWD worktree segment in both direct project layout and the
 * symlink-resolved external-state layout used by ~/.gwd/projects/<hash>.
 */
export function findWorktreeSegment(normalizedPath: string): WorktreeSegment | null {
  const directMarker = "/.gwd/worktrees/";
  const directIdx = normalizedPath.indexOf(directMarker);
  if (directIdx !== -1) {
    return { gwdIdx: directIdx, afterWorktrees: directIdx + directMarker.length };
  }

  const externalRe = /\/\.gwd\/projects\/[^/]+\/worktrees\//;
  const externalMatch = normalizedPath.match(externalRe);
  if (externalMatch && externalMatch.index !== undefined) {
    return {
      gwdIdx: externalMatch.index,
      afterWorktrees: externalMatch.index + externalMatch[0].length,
    };
  }

  return null;
}

export function isGsdWorktreePath(path: string): boolean {
  return findWorktreeSegment(path.replaceAll("\\", "/")) !== null;
}

/**
 * Resolve the canonical project root for worktree operations.
 *
 * `originalBasePath` wins when available because session state already knows the
 * root. `GWD_PROJECT_ROOT` is the next strongest signal for worker processes.
 * Otherwise, derive the root from direct `.gwd/worktrees` paths, or recover it
 * from the worktree `.git` file for symlink-resolved ~/.gwd/project paths.
 */
export function resolveWorktreeProjectRoot(
  basePath: string,
  originalBasePath?: string | null,
): string {
  const explicitOriginal = originalBasePath?.trim();
  if (explicitOriginal) return resolveProjectRootFromPath(explicitOriginal);

  const envProjectRoot = process.env.GWD_PROJECT_ROOT?.trim();
  if (envProjectRoot && isGsdWorktreePath(basePath)) {
    return resolveProjectRootFromPath(envProjectRoot);
  }

  return resolveProjectRootFromPath(basePath || envProjectRoot || process.cwd());
}

function resolveProjectRootFromPath(path: string): string {
  const normalizedPath = path.replaceAll("\\", "/");
  const segment = findWorktreeSegment(normalizedPath);
  if (!segment) {
    return resolveNearestBootstrappedGsdRoot(path) ?? resolveGitWorkingTreeRoot(path) ?? path;
  }

  const sepChar = path.includes("\\") ? "\\" : "/";
  const gsdMarker = `${sepChar}.gwd${sepChar}`;
  const markerIdx = path.indexOf(gsdMarker);
  const candidate = markerIdx !== -1
    ? path.slice(0, markerIdx)
    : path.slice(0, segment.gwdIdx);

  const gsdHomeNorm = normalizeWorktreePathForCompare(gsdHome());
  const candidateGsdPath = normalizeWorktreePathForCompare(join(candidate, ".gwd"));

  if (candidateGsdPath === gsdHomeNorm || candidateGsdPath.startsWith(`${gsdHomeNorm}/`)) {
    const realRoot = resolveProjectRootFromGitFile(path);
    return realRoot ?? path;
  }

  return candidate;
}

function resolveNearestBootstrappedGsdRoot(path: string): string | null {
  try {
    let dir = existsSync(path) && !statSync(path).isDirectory()
      ? resolve(path, "..")
      : path;
    const externalStateParent = normalizeWorktreePathForCompare(resolve(gsdHome(), ".."));

    for (let i = 0; i < 30; i++) {
      if (normalizeWorktreePathForCompare(dir) === externalStateParent) return null;
      if (hasGsdBootstrapArtifacts(join(dir, ".gwd"))) return dir;

      const gitPath = join(dir, ".git");
      if (existsSync(gitPath)) return null;

      const parent = resolve(dir, "..");
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // Non-fatal: callers fall back to git root resolution.
  }
  return null;
}

function hasGsdBootstrapArtifacts(gsdPath: string): boolean {
  return existsSync(gsdPath) &&
    (existsSync(join(gsdPath, "PREFERENCES.md")) ||
      existsSync(join(gsdPath, "preferences.md")) ||
      existsSync(join(gsdPath, "milestones")));
}

function resolveGitWorkingTreeRoot(path: string): string | null {
  try {
    let dir = existsSync(path) && !statSync(path).isDirectory()
      ? resolve(path, "..")
      : path;
    const externalStateParent = normalizeWorktreePathForCompare(resolve(gsdHome(), ".."));

    for (let i = 0; i < 30; i++) {
      if (normalizeWorktreePathForCompare(dir) === externalStateParent) return null;
      const gitPath = join(dir, ".git");
      if (existsSync(gitPath)) return dir;

      const parent = resolve(dir, "..");
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // Non-fatal: callers either keep the original path or fail closed.
  }
  return null;
}

function resolveProjectRootFromGitFile(worktreePath: string): string | null {
  try {
    let dir = worktreePath;
    for (let i = 0; i < 30; i++) {
      const gitPath = join(dir, ".git");
      if (existsSync(gitPath)) {
        const content = readFileSync(gitPath, "utf8").trim();
        if (content.startsWith("gitdir: ")) {
          const gitDir = resolve(dir, content.slice(8));
          const dotGitDir = resolve(gitDir, "..", "..");
          if (dotGitDir.endsWith(".git") || dotGitDir.endsWith(".git/") || dotGitDir.endsWith(".git\\")) {
            return resolve(dotGitDir, "..");
          }

          const commonDirPath = join(gitDir, "commondir");
          if (existsSync(commonDirPath)) {
            const commonDir = readFileSync(commonDirPath, "utf8").trim();
            const resolvedCommonDir = resolve(gitDir, commonDir);
            return resolve(resolvedCommonDir, "..");
          }
        }
        break;
      }

      const parent = resolve(dir, "..");
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // Non-fatal: callers either keep the original path or fail closed.
  }
  return null;
}
