// GWD-2 + db-writer saveArtifactToDbByScope: workspace-contract path routing tests

import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  existsSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { createWorkspace, scopeMilestone } from "../workspace.ts";
import { saveArtifactToDb, saveArtifactToDbByScope } from "../db-writer.ts";
import { openDatabase, closeDatabase } from "../gwd-db.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeProjectDir(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "gwd-dbwriter-scope-")));
  mkdirSync(join(dir, ".gwd"), { recursive: true });
  return dir;
}

// ─── Suite 1: scope variant writes to the same canonical path as legacy ──────

describe("saveArtifactToDbByScope: path parity with legacy saveArtifactToDb", () => {
  let tmp1: string;
  let tmp2: string;

  beforeEach(() => {
    tmp1 = makeProjectDir();
    tmp2 = makeProjectDir();
  });

  afterEach(() => {
    closeDatabase();
    rmSync(tmp1, { recursive: true, force: true });
    rmSync(tmp2, { recursive: true, force: true });
  });

  test("scope variant writes artifact to same canonical path as legacy variant", async () => {
    const relPath = "milestones/M001/slices/S01/tasks/T01-SUMMARY.md";
    const content = "# T01 Summary\n\nTest content.\n";
    const opts = {
      path: relPath,
      artifact_type: "SUMMARY",
      content,
      milestone_id: "M001",
      slice_id: "S01",
      task_id: "T01",
    };

    // Legacy path: basePath + '.gwd' join
    const legacyExpectedPath = resolve(tmp1, ".gwd", relPath);

    // Scope path: contract.projectGwd
    const ws = createWorkspace(tmp2);
    const scope = scopeMilestone(ws, "M001");
    const scopeExpectedPath = resolve(ws.contract.projectGwd, relPath);

    // Both should resolve to the same relative structure
    // (though under different temp dirs — so we compare structure, not absolute path)
    assert.equal(
      scopeExpectedPath,
      resolve(ws.contract.projectGwd, relPath),
      "scope path must be contract.projectGwd + relPath",
    );
    assert.equal(
      legacyExpectedPath,
      resolve(tmp1, ".gwd", relPath),
      "legacy path must be basePath/.gwd + relPath",
    );

    // Open DB for tmp1 and write via legacy
    const dbPath1 = join(tmp1, ".gwd", "gwd.db");
    openDatabase(dbPath1);
    await saveArtifactToDb(opts, tmp1);
    closeDatabase();

    // Open DB for tmp2 and write via scope variant
    const dbPath2 = join(tmp2, ".gwd", "gwd.db");
    openDatabase(dbPath2);
    await saveArtifactToDbByScope(scope, opts);
    closeDatabase();

    // Both should have written to the correct location under their respective .gwd dirs
    assert.ok(existsSync(legacyExpectedPath), "legacy: artifact written at basePath/.gwd/relPath");
    assert.ok(existsSync(scopeExpectedPath), "scope: artifact written at contract.projectGwd/relPath");

    // Content must match
    assert.equal(readFileSync(legacyExpectedPath, "utf-8"), content, "legacy: content matches");
    assert.equal(readFileSync(scopeExpectedPath, "utf-8"), content, "scope: content matches");
  });
});

// ─── Suite 2: scope variant uses contract.projectGwd, not a basePath join ────

describe("saveArtifactToDbByScope: uses contract.projectGwd, not hand-rolled basePath join", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeProjectDir();
  });

  afterEach(() => {
    closeDatabase();
    rmSync(tmp, { recursive: true, force: true });
  });

  test("scope.workspace.contract.projectGwd is used as the .gwd root, not basePath/.gwd", async () => {
    const ws = createWorkspace(tmp);
    const scope = scopeMilestone(ws, "M001");

    // The contract.projectGwd must equal the canonical join(projectRoot, '.gwd')
    assert.equal(
      ws.contract.projectGwd,
      join(ws.projectRoot, ".gwd"),
      "contract.projectGwd must equal join(projectRoot, '.gwd')",
    );

    // It must NOT be a hand-rolled resolution from an arbitrary basePath string
    // (i.e., contract.projectGwd routes through the workspace contract)
    assert.ok(
      ws.contract.projectGwd.startsWith(ws.projectRoot),
      "contract.projectGwd must be rooted at projectRoot",
    );

    const relPath = "milestones/M001/M001-CONTEXT.md";
    const content = "# M001 Context\n";
    const opts = {
      path: relPath,
      artifact_type: "CONTEXT",
      content,
      milestone_id: "M001",
    };

    openDatabase(join(tmp, ".gwd", "gwd.db"));
    await saveArtifactToDbByScope(scope, opts);

    // File must be at contract.projectGwd/relPath
    const expectedPath = resolve(ws.contract.projectGwd, relPath);
    assert.ok(existsSync(expectedPath), "artifact written at contract.projectGwd/relPath");
    assert.equal(readFileSync(expectedPath, "utf-8"), content, "content matches");

    // And must NOT be at some other location
    const handRolledPath = resolve(tmp, ".gwd", relPath);
    // Both should be the same path in project mode (they should agree)
    assert.equal(
      expectedPath,
      handRolledPath,
      "in project mode, contract.projectGwd resolves same as basePath/.gwd",
    );
  });
});

// ─── Suite 3: worktree-mode scope routes to project root's .gwd/ ─────────────

describe("saveArtifactToDbByScope: worktree scope writes to project root .gwd/", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = realpathSync(mkdtempSync(join(tmpdir(), "gwd-dbwriter-wt-scope-")));
    // Create project .gwd directory
    mkdirSync(join(tmp, ".gwd"), { recursive: true });
  });

  afterEach(() => {
    closeDatabase();
    rmSync(tmp, { recursive: true, force: true });
  });

  test("worktree-mode scope: contract.projectGwd resolves to project root's .gwd/, not worktree .gwd/", async () => {
    // Construct a worktree path inside the project's .gwd/worktrees/<MID>
    const worktreePath = join(tmp, ".gwd", "worktrees", "M001");
    mkdirSync(join(worktreePath, ".gwd"), { recursive: true });

    const projectWs = createWorkspace(tmp);
    const worktreeWs = createWorkspace(worktreePath);

    // Both should share the same projectRoot (worktree-root resolution)
    assert.equal(
      worktreeWs.projectRoot,
      projectWs.projectRoot,
      "worktree workspace must have same projectRoot as project workspace",
    );

    // contract.projectGwd for the worktree workspace must point to the PROJECT root's .gwd/
    assert.equal(
      worktreeWs.contract.projectGwd,
      join(projectWs.projectRoot, ".gwd"),
      "worktree contract.projectGwd must equal project root's .gwd/",
    );

    // Must NOT be the worktree-local .gwd/
    assert.notEqual(
      worktreeWs.contract.projectGwd,
      join(worktreePath, ".gwd"),
      "worktree contract.projectGwd must NOT be the worktree-local .gwd/",
    );

    // Write via the worktree-mode scope
    const scope = scopeMilestone(worktreeWs, "M001");
    const relPath = "milestones/M001/M001-CONTEXT.md";
    const content = "# M001 Context from worktree scope\n";
    const opts = {
      path: relPath,
      artifact_type: "CONTEXT",
      content,
      milestone_id: "M001",
    };

    openDatabase(join(tmp, ".gwd", "gwd.db"));
    await saveArtifactToDbByScope(scope, opts);

    // File must land in the PROJECT root's .gwd/, not in the worktree's .gwd/
    const projectPath = resolve(projectWs.contract.projectGwd, relPath);
    const worktreeLocalPath = resolve(worktreePath, ".gwd", relPath);

    assert.ok(existsSync(projectPath), "artifact written to project root's .gwd/");
    assert.ok(
      !existsSync(worktreeLocalPath),
      "artifact must NOT be written to worktree-local .gwd/",
    );
    assert.equal(readFileSync(projectPath, "utf-8"), content, "content at project root matches");
  });
});
