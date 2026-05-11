/**
 * GWD External State Migration
 *
 * Migrates legacy in-project `.gwd/` directories to the external
 * `~/.gwd/projects/<hash>/` state directory. After migration, a
 * symlink replaces the original directory so all paths remain valid.
 */

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, renameSync, cpSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { externalGwdRoot, isInsideWorktree } from "./repo-identity.js";
import { getErrorMessage } from "./error-utils.js";
import { hasGitTrackedGwdFiles } from "./gitignore.js";
import { GIT_NO_PROMPT_ENV } from "./git-constants.js";

export interface MigrationResult {
  migrated: boolean;
  error?: string;
}

/**
 * Migrate a legacy in-project `.gwd/` directory to external storage.
 *
 * Algorithm:
 * 1. If `<project>/.gwd` is a symlink or doesn't exist -> skip
 * 2. If `<project>/.gwd` is a real directory:
 *    a. Compute external path from repoIdentity
 *    b. mkdir -p external dir
 *    c. Rename `.gwd` -> `.gwd.migrating` (atomic on same FS, acts as lock)
 *    d. Copy contents to external dir (skip `worktrees/` subdirectory)
 *    e. Create symlink `.gwd -> external path`
 *    f. Remove `.gwd.migrating`
 * 3. On failure: rename `.gwd.migrating` back to `.gwd` (rollback)
 */
export function migrateToExternalState(basePath: string): MigrationResult {
  // Worktrees get their .gwd via syncGwdStateToWorktree(), not migration.
  // Migration inside a worktree would compute the same external hash as the
  // main repo (externalGwdRoot hashes remoteUrl + gitRoot), creating a broken
  // junction and orphaning .gwd.migrating (#2970).
  if (isInsideWorktree(basePath)) {
    return { migrated: false };
  }

  const localGwd = join(basePath, ".gwd");

  // Skip if doesn't exist
  if (!existsSync(localGwd)) {
    return { migrated: false };
  }

  // Skip if already a symlink
  try {
    const stat = lstatSync(localGwd);
    if (stat.isSymbolicLink()) {
      return { migrated: false };
    }
    if (!stat.isDirectory()) {
      return { migrated: false, error: ".gwd exists but is not a directory or symlink" };
    }
  } catch (err) {
    return { migrated: false, error: `Cannot stat .gwd: ${getErrorMessage(err)}` };
  }

  // Skip if .gwd/ contains git-tracked files — the project intentionally
  // keeps .gwd/ in version control and migration would destroy that.
  if (hasGitTrackedGwdFiles(basePath)) {
    return { migrated: false };
  }

  // Skip if .gwd/worktrees/ has active worktree directories (#1337).
  // On Windows, active git worktrees hold OS-level directory handles that
  // prevent rename/delete. Attempting migration causes EBUSY and data loss.
  const worktreesDir = join(localGwd, "worktrees");
  if (existsSync(worktreesDir)) {
    try {
      const entries = readdirSync(worktreesDir, { withFileTypes: true });
      if (entries.some(e => e.isDirectory())) {
        return { migrated: false };
      }
    } catch {
      // Can't read worktrees dir — skip migration to be safe
      return { migrated: false };
    }
  }

  const externalPath = externalGwdRoot(basePath);
  const migratingPath = join(basePath, ".gwd.migrating");

  try {
    // mkdir -p the external dir
    mkdirSync(externalPath, { recursive: true });

    // Rename .gwd -> .gwd.migrating (atomic lock).
    // On Windows, NTFS may reject rename with EPERM if file descriptors are
    // open (VS Code watchers, antivirus on-access scan). Fall back to
    // copy+delete (#1292).
    try {
      renameSync(localGwd, migratingPath);
    } catch (renameErr: any) {
      if (renameErr?.code === "EPERM" || renameErr?.code === "EBUSY") {
        try {
          cpSync(localGwd, migratingPath, { recursive: true, force: true });
          rmSync(localGwd, { recursive: true, force: true });
        } catch (copyErr) {
          return { migrated: false, error: `Migration rename/copy failed: ${copyErr instanceof Error ? copyErr.message : String(copyErr)}` };
        }
      } else {
        throw renameErr;
      }
    }

    // Copy contents to external dir, skipping worktrees/
    const entries = readdirSync(migratingPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "worktrees") continue; // worktrees stay local

      const src = join(migratingPath, entry.name);
      const dst = join(externalPath, entry.name);

      try {
        if (entry.isDirectory()) {
          cpSync(src, dst, { recursive: true, force: true });
        } else {
          cpSync(src, dst, { force: true });
        }
      } catch {
        // Non-fatal: continue with other files
      }
    }

    // Create symlink .gwd -> external path
    symlinkSync(externalPath, localGwd, "junction");

    // Verify the symlink resolves correctly before removing the backup (#1377).
    // On Windows, junction creation can silently succeed but resolve to the wrong
    // target, or the external dir may not be accessible. If verification fails,
    // restore from the backup.
    try {
      const resolved = realpathSync(localGwd);
      const resolvedExternal = realpathSync(externalPath);
      if (resolved !== resolvedExternal) {
        // Symlink points to wrong target — restore backup
        try { rmSync(localGwd, { force: true }); } catch { /* may not exist */ }
        renameSync(migratingPath, localGwd);
        return { migrated: false, error: `Migration verification failed: symlink resolves to ${resolved}, expected ${resolvedExternal}` };
      }
      // Verify we can read through the symlink
      readdirSync(localGwd);
    } catch (verifyErr) {
      // Symlink broken or unreadable — restore backup
      try { rmSync(localGwd, { force: true }); } catch { /* may not exist */ }
      try { renameSync(migratingPath, localGwd); } catch { /* best-effort restore */ }
      return { migrated: false, error: `Migration verification failed: ${getErrorMessage(verifyErr)}` };
    }

    // Clean the git index — any .gwd/* files tracked before migration now
    // sit behind the symlink and git can't follow it, causing them to show
    // as deleted. Remove them from the index so the working tree stays clean.
    // --ignore-unmatch makes this a no-op on fresh projects with no tracked .gwd/.
    try {
      execFileSync("git", ["rm", "-r", "--cached", "--ignore-unmatch", ".gwd"], {
        cwd: basePath,
        stdio: ["ignore", "pipe", "ignore"],
        env: GIT_NO_PROMPT_ENV,
        timeout: 10_000,
      });
    } catch {
      // Non-fatal — git may be unavailable or nothing was tracked
    }

    // Remove .gwd.migrating only after symlink is verified and index is clean
    rmSync(migratingPath, { recursive: true, force: true });

    return { migrated: true };
  } catch (err) {
    // Rollback: rename .gwd.migrating back to .gwd
    try {
      if (existsSync(migratingPath) && !existsSync(localGwd)) {
        renameSync(migratingPath, localGwd);
      }
    } catch {
      // Rollback failed -- leave .gwd.migrating for doctor to detect
    }

    return {
      migrated: false,
      error: `Migration failed: ${getErrorMessage(err)}`,
    };
  }
}

/**
 * Recover from a failed migration (`.gwd.migrating` exists).
 * Moves `.gwd.migrating` back to `.gwd` if `.gwd` doesn't exist.
 */
export function recoverFailedMigration(basePath: string): boolean {
  const localGwd = join(basePath, ".gwd");
  const migratingPath = join(basePath, ".gwd.migrating");

  if (!existsSync(migratingPath)) return false;
  if (existsSync(localGwd)) return false; // both exist -- ambiguous, don't touch

  try {
    renameSync(migratingPath, localGwd);
    return true;
  } catch {
    return false;
  }
}
