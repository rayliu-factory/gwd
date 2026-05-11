// GWD-2 + gwd-root-canonical: gwdRoot() result is realpath-canonicalized before caching

import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { gwdRoot, _clearGwdRootCache } from "../paths.ts";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("gwdRoot: returns realpath-canonicalized result", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = realpathSync(mkdtempSync(join(tmpdir(), "gwd-root-canon-")));
    mkdirSync(join(projectDir, ".gwd"), { recursive: true });
    _clearGwdRootCache();
  });

  afterEach(() => {
    _clearGwdRootCache();
    rmSync(projectDir, { recursive: true, force: true });
  });

  test("gwdRoot from a canonical project path returns a realpath-canonicalized result", () => {
    const result = gwdRoot(projectDir);
    const canonical = realpathSync(join(projectDir, ".gwd"));
    assert.equal(result, canonical, "gwdRoot must return the realpath of the .gwd directory");
  });

  test("gwdRoot via a symlinked project path returns the realpath-canonicalized .gwd", (t) => {
    // Create a symlink pointing to projectDir
    const linkPath = join(tmpdir(), `gwd-root-link-${randomUUID()}`);
    symlinkSync(projectDir, linkPath);
    t.after(() => {
      try { rmSync(linkPath); } catch { /* ignore */ }
    });

    _clearGwdRootCache();

    const result = gwdRoot(linkPath);
    // The canonical .gwd is under the realpath of projectDir, not the symlink
    const canonicalGwd = realpathSync(join(projectDir, ".gwd"));

    assert.equal(
      result,
      canonicalGwd,
      `gwdRoot via symlink ("${linkPath}") must return the realpath'd .gwd ("${canonicalGwd}"), not a symlink-based path`,
    );

    // Also verify that the result does NOT contain the symlink in its path
    assert.ok(
      !result.startsWith(linkPath),
      `gwdRoot result must not start with the symlink path "${linkPath}"`,
    );
  });
});
