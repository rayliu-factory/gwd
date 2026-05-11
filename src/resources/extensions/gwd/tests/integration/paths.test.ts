import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { gsdRoot, _clearGwdRootCache } from "../../paths.ts";
/** Create a tmp dir and resolve symlinks + 8.3 short names (macOS /var→/private/var, Windows RUNNER~1→runneradmin). */
function tmp(): string {
  const p = mkdtempSync(join(tmpdir(), "gsd-paths-test-"));
  try { return realpathSync.native(p); } catch { return p; }
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function initGit(dir: string): void {
  spawnSync("git", ["init"], { cwd: dir });
  spawnSync("git", ["commit", "--allow-empty", "-m", "init"], { cwd: dir });
}

describe('paths', () => {
  test('Case 1: .gwd exists at basePath — fast path', () => {
    const root = tmp();
    try {
      mkdirSync(join(root, ".gwd"));
      _clearGwdRootCache();
      const result = gsdRoot(root);
      assert.deepStrictEqual(result, join(root, ".gwd"), "fast path: returns basePath/.gwd");
    } finally { cleanup(root); }
  });

  test('Case 2: .gwd exists at git root, cwd is a subdirectory', () => {
    const root = tmp();
    try {
      initGit(root);
      mkdirSync(join(root, ".gwd"));
      const sub = join(root, "src", "deep");
      mkdirSync(sub, { recursive: true });
      _clearGwdRootCache();
      const result = gsdRoot(sub);
      assert.deepStrictEqual(result, join(root, ".gwd"), "git-root probe: finds .gwd at git root from subdirectory");
    } finally { cleanup(root); }
  });

  test('Case 3: .gwd in an ancestor — walk-up finds it', () => {
    const root = tmp();
    try {
      initGit(root);
      const project = join(root, "project");
      mkdirSync(join(project, ".gwd"), { recursive: true });
      const deep = join(project, "src", "deep");
      mkdirSync(deep, { recursive: true });
      _clearGwdRootCache();
      const result = gsdRoot(deep);
      assert.deepStrictEqual(result, join(project, ".gwd"), "walk-up: finds .gwd in ancestor when git root has none");
    } finally { cleanup(root); }
  });

  test('Case 4: .gwd nowhere — fallback returns original basePath/.gwd', () => {
    const root = tmp();
    try {
      initGit(root);
      const sub = join(root, "src");
      mkdirSync(sub, { recursive: true });
      _clearGwdRootCache();
      const result = gsdRoot(sub);
      assert.deepStrictEqual(result, join(sub, ".gwd"), "fallback: returns basePath/.gwd when .gwd not found anywhere");
    } finally { cleanup(root); }
  });

  test('Case 5: cache — second call returns same value without re-probing', () => {
    const root = tmp();
    try {
      mkdirSync(join(root, ".gwd"));
      _clearGwdRootCache();
      const first = gsdRoot(root);
      const second = gsdRoot(root);
      assert.deepStrictEqual(first, second, "cache: same result returned on second call");
      assert.ok(first === second, "cache: identity check (same string)");
    } finally { cleanup(root); }
  });

  test('Case 6: .gwd at basePath takes precedence over ancestor .gwd', () => {
    const outer = tmp();
    try {
      initGit(outer);
      mkdirSync(join(outer, ".gwd"));
      const inner = join(outer, "nested");
      mkdirSync(join(inner, ".gwd"), { recursive: true });
      _clearGwdRootCache();
      const result = gsdRoot(inner);
      assert.deepStrictEqual(result, join(inner, ".gwd"), "precedence: nearest .gwd wins over ancestor");
    } finally { cleanup(outer); }
  });
});
