// GWD-2 + gsd-root-canonical: gsdRoot() result is realpath-canonicalized before caching

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

import { gsdRoot, _clearGwdRootCache } from "../paths.ts";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("gsdRoot: returns realpath-canonicalized result", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = realpathSync(mkdtempSync(join(tmpdir(), "gsd-root-canon-")));
    mkdirSync(join(projectDir, ".gwd"), { recursive: true });
    _clearGwdRootCache();
  });

  afterEach(() => {
    _clearGwdRootCache();
    rmSync(projectDir, { recursive: true, force: true });
  });

  test("gsdRoot from a canonical project path returns a realpath-canonicalized result", () => {
    const result = gsdRoot(projectDir);
    const canonical = realpathSync(join(projectDir, ".gwd"));
    assert.equal(result, canonical, "gsdRoot must return the realpath of the .gwd directory");
  });

  test("gsdRoot via a symlinked project path returns the realpath-canonicalized .gwd", (t) => {
    // Create a symlink pointing to projectDir
    const linkPath = join(tmpdir(), `gsd-root-link-${randomUUID()}`);
    symlinkSync(projectDir, linkPath);
    t.after(() => {
      try { rmSync(linkPath); } catch { /* ignore */ }
    });

    _clearGwdRootCache();

    const result = gsdRoot(linkPath);
    // The canonical .gwd is under the realpath of projectDir, not the symlink
    const canonicalGsd = realpathSync(join(projectDir, ".gwd"));

    assert.equal(
      result,
      canonicalGsd,
      `gsdRoot via symlink ("${linkPath}") must return the realpath'd .gwd ("${canonicalGsd}"), not a symlink-based path`,
    );

    // Also verify that the result does NOT contain the symlink in its path
    assert.ok(
      !result.startsWith(linkPath),
      `gsdRoot result must not start with the symlink path "${linkPath}"`,
    );
  });
});
