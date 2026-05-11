// GWD-2 + db-writer path containment: regression tests for path.relative-based traversal guard

import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openDatabase, closeDatabase } from "../gwd-db.ts";
import { createWorkspace, scopeMilestone } from "../workspace.ts";
import {
  saveArtifactToDbForWorkspace,
  saveArtifactToDbByScope,
} from "../db-writer.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProjectDir(base: string): string {
  mkdirSync(join(base, ".gwd", "milestones"), { recursive: true });
  return base;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("saveArtifactToDbForWorkspace: path.relative containment guard", () => {
  let tmp: string;
  let projectDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "gwd-path-contain-fw-"));
    projectDir = makeProjectDir(tmp);
    openDatabase(join(projectDir, ".gwd", "gwd.db"));
  });

  afterEach(() => {
    closeDatabase();
    rmSync(tmp, { recursive: true, force: true });
  });

  // Attack: /foo/.gwd-other/file resolves to a path that startsWith("/foo/.gwd")
  // but is NOT inside /foo/.gwd/. The path.relative fix correctly detects this.
  test("rejects sibling directory that startsWith would have accepted", async () => {
    // Create a sibling directory next to .gwd that shares the prefix
    const sibling = join(projectDir, ".gwd-other");
    mkdirSync(sibling, { recursive: true });

    const ws = createWorkspace(projectDir);
    // Craft an opts.path that traverses out of .gwd into .gwd-other
    // resolve(gsdDir, "../.gwd-other/evil.md") === projectDir + "/.gwd-other/evil.md"
    // which startsWith(projectDir + "/.gwd") because ".gwd-other" starts with ".gwd"
    const traversalPath = "../.gwd-other/evil.md";

    await assert.rejects(
      () =>
        saveArtifactToDbForWorkspace(ws, {
          path: traversalPath,
          artifact_type: "CONTEXT",
          content: "attack",
        }),
      /path escapes \.gwd\/ directory/,
    );
  });

  test("rejects absolute path input", async () => {
    const ws = createWorkspace(projectDir);
    await assert.rejects(
      () =>
        saveArtifactToDbForWorkspace(ws, {
          path: "/etc/passwd",
          artifact_type: "CONTEXT",
          content: "attack",
        }),
      /path escapes \.gwd\/ directory/,
    );
  });

  test("accepts a legitimate path inside .gwd/", async () => {
    const ws = createWorkspace(projectDir);
    // Should not throw — CONTEXT.md inside .gwd is valid
    await assert.doesNotReject(() =>
      saveArtifactToDbForWorkspace(ws, {
        path: "CONTEXT.md",
        artifact_type: "CONTEXT",
        content: "# Context\n",
      }),
    );
  });
});

describe("saveArtifactToDbByScope: path.relative containment guard", () => {
  let tmp: string;
  let projectDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "gwd-path-contain-bs-"));
    projectDir = makeProjectDir(tmp);
    openDatabase(join(projectDir, ".gwd", "gwd.db"));
  });

  afterEach(() => {
    closeDatabase();
    rmSync(tmp, { recursive: true, force: true });
  });

  test("rejects sibling directory that startsWith would have accepted", async () => {
    const sibling = join(projectDir, ".gwd-other");
    mkdirSync(sibling, { recursive: true });

    const ws = createWorkspace(projectDir);
    const scope = scopeMilestone(ws, "M001");
    const traversalPath = "../.gwd-other/evil.md";

    await assert.rejects(
      () =>
        saveArtifactToDbByScope(scope, {
          path: traversalPath,
          artifact_type: "CONTEXT",
          content: "attack",
        }),
      /path escapes \.gwd\/ directory/,
    );
  });

  test("rejects absolute path input", async () => {
    const ws = createWorkspace(projectDir);
    const scope = scopeMilestone(ws, "M001");
    await assert.rejects(
      () =>
        saveArtifactToDbByScope(scope, {
          path: "/etc/passwd",
          artifact_type: "CONTEXT",
          content: "attack",
        }),
      /path escapes \.gwd\/ directory/,
    );
  });

  test("accepts a legitimate milestone-relative path inside .gwd/", async () => {
    mkdirSync(join(projectDir, ".gwd", "milestones", "M001"), {
      recursive: true,
    });
    const ws = createWorkspace(projectDir);
    const scope = scopeMilestone(ws, "M001");
    await assert.doesNotReject(() =>
      saveArtifactToDbByScope(scope, {
        path: "milestones/M001/M001-CONTEXT.md",
        artifact_type: "CONTEXT",
        content: "# Context\n",
      }),
    );
  });
});
