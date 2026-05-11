/**
 * Regression tests for #2684 plus uppercase-preference normalization:
 * preferences files are handled explicitly
 * outside ROOT_STATE_FILES and prefer canonical PREFERENCES.md over the
 * legacy lowercase fallback.
 *
 * Without this, post_unit_hooks and all preference-driven config silently
 * stop working inside auto-mode worktrees.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { syncWorktreeStateBack } from "../auto-worktree.ts";

test("#2684: syncWorktreeStateBack does not overwrite project PREFERENCES.md", () => {
  const mainBase = mkdtempSync(join(tmpdir(), "gwd-wt-prefs-main-"));
  const wtBase = mkdtempSync(join(tmpdir(), "gwd-wt-prefs-worktree-"));
  const mainGwd = join(mainBase, ".gwd");
  const wtGwd = join(wtBase, ".gwd");
  mkdirSync(mainGwd, { recursive: true });
  mkdirSync(wtGwd, { recursive: true });

  try {
    const authoritative = "---\nversion: 1\n---\n\nmode: team\n";
    writeFileSync(join(mainGwd, "PREFERENCES.md"), authoritative);
    writeFileSync(join(wtGwd, "PREFERENCES.md"), "---\nversion: 1\n---\n\nmode: solo\n");

    const result = syncWorktreeStateBack(mainBase, wtBase, "M001");

    assert.equal(readFileSync(join(mainGwd, "PREFERENCES.md"), "utf-8"), authoritative);
    assert.ok(!result.synced.includes("PREFERENCES.md"));
    assert.ok(!result.synced.includes("preferences.md"));
  } finally {
    rmSync(mainBase, { recursive: true, force: true });
    rmSync(wtBase, { recursive: true, force: true });
  }
});

// Phase C: copyPlanningArtifacts was deleted. Worktrees no longer
// maintain a parallel .gwd/ projection; preference seeding is now
// handled exclusively by syncGwdStateToWorktree() (covered below).

test("syncGwdStateToWorktree copies canonical PREFERENCES.md", async () => {
  // Functional test: create a mock source and destination, call the sync
  const srcBase = mkdtempSync(join(tmpdir(), "gwd-wt-prefs-src-"));
  const dstBase = mkdtempSync(join(tmpdir(), "gwd-wt-prefs-dst-"));
  const srcGwd = join(srcBase, ".gwd");
  const dstGwd = join(dstBase, ".gwd");
  mkdirSync(srcGwd, { recursive: true });
  mkdirSync(dstGwd, { recursive: true });

  try {
    // Write a canonical PREFERENCES.md in source
    writeFileSync(
      join(srcGwd, "PREFERENCES.md"),
      "---\nversion: 1\n---\n\npost_unit_hooks:\n  - name: notify\n    command: echo done\n",
    );

    // Import and call syncGwdStateToWorktree
    const { syncGwdStateToWorktree } = await import("../auto-worktree.ts");
    syncGwdStateToWorktree(srcBase, dstBase);

    // Verify PREFERENCES.md was copied
    assert.ok(
      existsSync(join(dstGwd, "PREFERENCES.md")),
      "PREFERENCES.md should be copied to worktree",
    );

    const content = readFileSync(join(dstGwd, "PREFERENCES.md"), "utf-8");
    assert.ok(
      content.includes("post_unit_hooks"),
      "copied PREFERENCES.md should contain the hooks config",
    );
  } finally {
    rmSync(srcBase, { recursive: true, force: true });
    rmSync(dstBase, { recursive: true, force: true });
  }
});

test("syncGwdStateToWorktree falls back to legacy lowercase preferences.md", async () => {
  const srcBase = mkdtempSync(join(tmpdir(), "gwd-wt-prefs-legacy-src-"));
  const dstBase = mkdtempSync(join(tmpdir(), "gwd-wt-prefs-legacy-dst-"));
  const srcGwd = join(srcBase, ".gwd");
  const dstGwd = join(dstBase, ".gwd");
  mkdirSync(srcGwd, { recursive: true });
  mkdirSync(dstGwd, { recursive: true });

  try {
    writeFileSync(
      join(srcGwd, "preferences.md"),
      "---\nversion: 1\n---\n\ngit:\n  auto_push: true\n",
    );

    const { syncGwdStateToWorktree } = await import("../auto-worktree.ts");
    const result = syncGwdStateToWorktree(srcBase, dstBase);

    const copiedEntries = readdirSync(dstGwd)
      .filter((name) => name === "PREFERENCES.md" || name === "preferences.md");

    assert.ok(
      copiedEntries.length === 1,
      `expected exactly one preferences file in worktree, got ${copiedEntries.join(", ") || "(none)"}`,
    );
    assert.ok(
      copiedEntries[0] === "PREFERENCES.md" || copiedEntries[0] === "preferences.md",
      "legacy fallback should still result in one readable preferences file",
    );
    assert.ok(
      result.synced.includes("preferences.md") || result.synced.includes("PREFERENCES.md"),
      "legacy fallback copy should be reported in synced list",
    );
  } finally {
    rmSync(srcBase, { recursive: true, force: true });
    rmSync(dstBase, { recursive: true, force: true });
  }
});
