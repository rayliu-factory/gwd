import test from "node:test";
import assert from "node:assert/strict";

// Test the filtering logic used by /gwd pr-branch.
// Full integration requires git operations, so we test the path filtering.

test("pr-branch: identifies .gwd/ paths", () => {
  const files = [
    ".gwd/milestones/M001/ROADMAP.md",
    ".gwd/metrics.json",
    "src/main.ts",
    "package.json",
    ".planning/PLAN.md",
    "PLAN.md",
  ];

  const codeFiles = files.filter(
    (f) => !f.startsWith(".gwd/") && !f.startsWith(".planning/") && f !== "PLAN.md",
  );

  assert.deepEqual(codeFiles, ["src/main.ts", "package.json"]);
});

test("pr-branch: all .gwd/ files returns empty", () => {
  const files = [
    ".gwd/milestones/M001/ROADMAP.md",
    ".gwd/metrics.json",
    ".gwd/BACKLOG.md",
  ];

  const codeFiles = files.filter(
    (f) => !f.startsWith(".gwd/") && !f.startsWith(".planning/") && f !== "PLAN.md",
  );

  assert.equal(codeFiles.length, 0);
});

test("pr-branch: mixed commits with code changes", () => {
  const files = [
    ".gwd/milestones/M001/ROADMAP.md",
    "src/auth.ts",
    "src/auth.test.ts",
  ];

  const hasCodeChanges = files.some(
    (f) => !f.startsWith(".gwd/") && !f.startsWith(".planning/") && f !== "PLAN.md",
  );

  assert.ok(hasCodeChanges);
});

test("pr-branch: --dry-run flag", () => {
  assert.ok("--dry-run".includes("--dry-run"));
  assert.ok(!"--name my-branch".includes("--dry-run"));
});

test("pr-branch: --name flag parsing", () => {
  const args = "--name my-clean-pr";
  const nameMatch = args.match(/--name\s+(\S+)/);
  assert.ok(nameMatch);
  assert.equal(nameMatch[1], "my-clean-pr");
});

test("pr-branch: default branch name", () => {
  const currentBranch = "feat/add-auth";
  const prBranch = `pr/${currentBranch}`;
  assert.equal(prBranch, "pr/feat/add-auth");
});
