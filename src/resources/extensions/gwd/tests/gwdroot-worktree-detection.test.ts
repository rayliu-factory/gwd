/**
 * gwdroot-worktree-detection.test.ts — Regression test for #2594.
 *
 * gwdRoot() must return the canonical project .gwd directory when basePath
 * is inside a .gwd/worktrees/<name>/ structure. Worktree-local .gwd folders
 * are legacy projection roots only; runtime state is DB-authoritative at the
 * project .gwd.
 *
 * The bug: when a git worktree lives at /project/.gwd/worktrees/M008/,
 * probeGwdRoot() runs `git rev-parse --show-toplevel` which can return the
 * main project root (not the worktree root) depending on git version and
 * worktree setup. The walk-up then finds /project/.gwd and returns that
 * instead of the worktree's own .gwd path.
 */

import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { gwdRoot, resolveGwdPathContract, _clearGwdRootCache } from "../paths.ts";

describe("gwdRoot() worktree detection (#2594)", () => {
  let projectRoot: string;
  let projectGwd: string;

  beforeEach(() => {
    _clearGwdRootCache();
    // Create a temporary project with a git repo to simulate real conditions.
    // realpathSync handles macOS /tmp -> /private/tmp.
    projectRoot = realpathSync(mkdtempSync(join(tmpdir(), "gwdroot-wt-")));
    projectGwd = join(projectRoot, ".gwd");
    mkdirSync(projectGwd, { recursive: true });

    // Initialize a git repo in the project root so git rev-parse works
    spawnSync("git", ["init", "--initial-branch=main"], {
      cwd: projectRoot,
      stdio: "ignore",
    });
    spawnSync("git", ["config", "user.email", "test@test.com"], {
      cwd: projectRoot,
      stdio: "ignore",
    });
    spawnSync("git", ["config", "user.name", "Test"], {
      cwd: projectRoot,
      stdio: "ignore",
    });
    // Create an initial commit so we have a HEAD
    writeFileSync(join(projectRoot, "README.md"), "# Test");
    spawnSync("git", ["add", "."], { cwd: projectRoot, stdio: "ignore" });
    spawnSync("git", ["commit", "-m", "init"], {
      cwd: projectRoot,
      stdio: "ignore",
    });
  });

  afterEach(() => {
    _clearGwdRootCache();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  test("returns project .gwd when basePath is a worktree with its own .gwd", () => {
    // Simulates a worktree that already had copyPlanningArtifacts() run,
    // so it has its own .gwd/ directory.
    const worktreeBase = join(projectGwd, "worktrees", "M008");
    const worktreeGwd = join(worktreeBase, ".gwd");
    mkdirSync(worktreeGwd, { recursive: true });

    const result = gwdRoot(worktreeBase);
    assert.equal(
      result,
      projectGwd,
      `Expected canonical project .gwd (${projectGwd}), got ${result}.`,
    );
    assert.equal(resolveGwdPathContract(worktreeBase).worktreeGwd, worktreeGwd);
  });

  test("returns project .gwd when worktree .gwd does not exist yet", () => {
    const worktreeBase = join(projectGwd, "worktrees", "M008");
    mkdirSync(worktreeBase, { recursive: true });
    // NOTE: no .gwd/ inside worktreeBase

    const result = gwdRoot(worktreeBase);
    assert.equal(
      result,
      projectGwd,
      `Expected canonical project .gwd (${projectGwd}), got ${result}.`,
    );
  });

  test("returns project .gwd when basePath is a real git worktree inside .gwd/worktrees/", () => {
    // Create a real git worktree at .gwd/worktrees/M010
    const worktreeName = "M010";
    const worktreeBase = join(projectGwd, "worktrees", worktreeName);

    // Use git worktree add to create a real worktree
    const result = spawnSync(
      "git",
      ["worktree", "add", "-b", `milestone/${worktreeName}`, worktreeBase],
      { cwd: projectRoot, encoding: "utf-8" },
    );

    if (result.status !== 0) {
      // If git worktree add fails, skip the test gracefully
      assert.ok(true, "Skipped: git worktree add not available");
      return;
    }

    // The real git worktree exists at worktreeBase but has NO .gwd/ subdir yet
    const gwdResult = gwdRoot(worktreeBase);
    assert.equal(
      gwdResult,
      projectGwd,
      `Expected canonical project .gwd (${projectGwd}), got ${gwdResult}`,
    );

    // Cleanup worktree
    spawnSync("git", ["worktree", "remove", "--force", worktreeBase], {
      cwd: projectRoot,
      stdio: "ignore",
    });
  });

  test("still returns project .gwd for normal (non-worktree) basePath", () => {
    const result = gwdRoot(projectRoot);
    assert.equal(result, projectGwd);
  });

  test("still returns project .gwd for a subdirectory of the project", () => {
    const subdir = join(projectRoot, "src", "lib");
    mkdirSync(subdir, { recursive: true });

    const result = gwdRoot(subdir);
    assert.equal(
      result,
      projectGwd,
      "Non-worktree subdirectories should still resolve to project .gwd",
    );
  });
});
