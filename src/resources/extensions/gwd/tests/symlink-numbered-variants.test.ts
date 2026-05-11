/**
 * Tests for macOS numbered symlink variant cleanup (#2205).
 *
 * macOS can rename `.gwd` to `.gwd 2`, `.gwd 3`, etc. when a directory
 * already exists at the target path. ensureGsdSymlink() must detect and
 * remove these numbered variants so the real `.gwd` symlink is always
 * the one in use.
 */

import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  lstatSync,
  realpathSync,
  mkdirSync,
  symlinkSync,
  readlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

import { ensureGsdSymlink, externalGsdRoot } from "../repo-identity.ts";
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';


function run(command: string, cwd: string): string {
  return execSync(command, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf-8" }).trim();
}

describe('symlink-numbered-variants', async () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "gsd-symlink-variants-")));
  const stateDir = realpathSync(mkdtempSync(join(tmpdir(), "gsd-state-variants-")));

  try {
    process.env.GWD_STATE_DIR = stateDir;

    // Set up a minimal git repo
    run("git init -b main", base);
    run('git config user.name "Pi Test"', base);
    run('git config user.email "pi@example.com"', base);
    run('git remote add origin git@github.com:example/repo.git', base);
    writeFileSync(join(base, "README.md"), "# Test Repo\n", "utf-8");
    run("git add README.md", base);
    run('git commit -m "chore: init"', base);

    const externalPath = externalGsdRoot(base);

    // ── Test: numbered variant directories are cleaned up ──────────────
    console.log("\n=== ensureGsdSymlink removes numbered .gwd variants (#2205) ===");
    {
      // Simulate macOS creating numbered variants: ".gwd 2", ".gwd 3"
      mkdirSync(join(base, ".gwd 2"), { recursive: true });
      mkdirSync(join(base, ".gwd 3"), { recursive: true });
      mkdirSync(join(base, ".gwd 4"), { recursive: true });

      const result = ensureGsdSymlink(base);
      assert.deepStrictEqual(result, externalPath, "ensureGsdSymlink returns external path");
      assert.ok(existsSync(join(base, ".gwd")), ".gwd exists after ensureGsdSymlink");
      assert.ok(lstatSync(join(base, ".gwd")).isSymbolicLink(), ".gwd is a symlink");

      // The numbered variants must have been removed
      assert.ok(!existsSync(join(base, ".gwd 2")), '".gwd 2" directory was cleaned up');
      assert.ok(!existsSync(join(base, ".gwd 3")), '".gwd 3" directory was cleaned up');
      assert.ok(!existsSync(join(base, ".gwd 4")), '".gwd 4" directory was cleaned up');
    }

    // ── Test: numbered variant symlinks are cleaned up ─────────────────
    console.log("\n=== ensureGsdSymlink removes numbered symlink variants ===");
    {
      // Clean slate
      rmSync(join(base, ".gwd"), { recursive: true, force: true });

      // Simulate: ".gwd 2" is a symlink to the correct target (the real .gwd)
      // and ".gwd" doesn't exist — this is the actual macOS scenario
      const staleTarget = join(stateDir, "projects", "stale-target");
      mkdirSync(staleTarget, { recursive: true });
      symlinkSync(externalPath, join(base, ".gwd 2"), "junction");
      symlinkSync(staleTarget, join(base, ".gwd 3"), "junction");

      const result = ensureGsdSymlink(base);
      assert.deepStrictEqual(result, externalPath, "ensureGsdSymlink returns external path when variants exist");
      assert.ok(existsSync(join(base, ".gwd")), ".gwd exists");
      assert.ok(lstatSync(join(base, ".gwd")).isSymbolicLink(), ".gwd is a symlink");

      assert.ok(!existsSync(join(base, ".gwd 2")), '".gwd 2" symlink variant was cleaned up');
      assert.ok(!existsSync(join(base, ".gwd 3")), '".gwd 3" symlink variant was cleaned up');
    }

    // ── Test: real .gwd directory blocks symlink, but variants still cleaned ──
    console.log("\n=== ensureGsdSymlink cleans variants even when .gwd is a real directory ===");
    {
      // Clean slate
      rmSync(join(base, ".gwd"), { recursive: true, force: true });

      // .gwd is a real directory (git-tracked) and numbered variants exist
      mkdirSync(join(base, ".gwd", "milestones"), { recursive: true });
      writeFileSync(join(base, ".gwd", "milestones", "M001.md"), "# M001\n", "utf-8");
      mkdirSync(join(base, ".gwd 2"), { recursive: true });
      mkdirSync(join(base, ".gwd 3"), { recursive: true });

      const result = ensureGsdSymlink(base);
      // When .gwd is a real directory, ensureGsdSymlink preserves it
      assert.deepStrictEqual(result, join(base, ".gwd"), "real .gwd directory preserved");
      assert.ok(lstatSync(join(base, ".gwd")).isDirectory(), ".gwd remains a directory");

      // But the numbered variants should still be cleaned up
      assert.ok(!existsSync(join(base, ".gwd 2")), '".gwd 2" cleaned even when .gwd is a directory');
      assert.ok(!existsSync(join(base, ".gwd 3")), '".gwd 3" cleaned even when .gwd is a directory');
    }

    // ── Test: only numeric-suffixed variants are removed ───────────────
    console.log("\n=== ensureGsdSymlink only removes .gwd + space + digit variants ===");
    {
      rmSync(join(base, ".gwd"), { recursive: true, force: true });

      // These should NOT be touched
      mkdirSync(join(base, ".gwd-backup"), { recursive: true });
      mkdirSync(join(base, ".gwd_old"), { recursive: true });

      // These SHOULD be removed (macOS collision pattern)
      mkdirSync(join(base, ".gwd 2"), { recursive: true });
      mkdirSync(join(base, ".gwd 10"), { recursive: true });

      ensureGsdSymlink(base);

      assert.ok(existsSync(join(base, ".gwd-backup")), ".gwd-backup is NOT removed");
      assert.ok(existsSync(join(base, ".gwd_old")), ".gwd_old is NOT removed");
      assert.ok(!existsSync(join(base, ".gwd 2")), '".gwd 2" removed');
      assert.ok(!existsSync(join(base, ".gwd 10")), '".gwd 10" removed');

      // Cleanup non-variant dirs
      rmSync(join(base, ".gwd-backup"), { recursive: true, force: true });
      rmSync(join(base, ".gwd_old"), { recursive: true, force: true });
    }

  } finally {
    delete process.env.GWD_STATE_DIR;
    try { rmSync(base, { recursive: true, force: true }); } catch { /* ignore */ }
    try { rmSync(stateDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});
