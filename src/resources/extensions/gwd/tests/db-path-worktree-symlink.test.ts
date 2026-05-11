/**
 * db-path-worktree-symlink.test.ts — #2517
 *
 * Regression test for the db_unavailable loop in worktree/symlink layouts.
 *
 * The path resolver must handle BOTH worktree path families:
 *   - /.gwd/worktrees/<MID>/...           (direct layout)
 *   - /.gwd/projects/<hash>/worktrees/<MID>/...  (symlink-resolved layout)
 *
 * When the second layout is not recognised, ensureDbOpen derives a wrong DB
 * path, the open fails silently, and every completion tool call returns
 * db_unavailable — triggering an artifact retry re-dispatch loop.
 *
 * Additionally, the post-unit artifact retry path must NOT retry when the
 * completion tool failed due to db_unavailable (infra failure), because
 * retrying can never succeed and causes cost spikes.
 */

import { join, sep } from "node:path";
import { createTestContext } from "./test-helpers.ts";

const { assertEq, assertTrue, report } = createTestContext();

// ── Part 1: resolveProjectRootDbPath handles symlink-resolved layout ─────

console.log("\n=== #2517 Part 1: resolveProjectRootDbPath symlink layout ===");

// Import the resolver directly
const { resolveProjectRootDbPath } = await import("../bootstrap/dynamic-tools.js");

// Standard worktree layout (already works)
const standardPath = `/home/user/myproject/.gwd/worktrees/M001/work`;
const standardResult = resolveProjectRootDbPath(standardPath);
assertEq(
  standardResult,
  join("/home/user/myproject", ".gwd", "gwd.db"),
  "Standard worktree layout resolves to project root DB path",
);

// Symlink-resolved layout: /.gwd/projects/<hash>/worktrees/...
// After PR #2952, these paths resolve to the hash-level DB (same as external-state),
// because on POSIX getcwd() returns the canonical (symlink-resolved) path anyway, so
// a path like <proj>/.gwd/projects/<hash>/worktrees/ in practice is always
// ~/.gwd/projects/<hash>/worktrees/ after the OS resolves the .gwd symlink.
const symlinkPath = `/home/user/myproject/.gwd/projects/abc123def/worktrees/M001/work`;
const symlinkResult = resolveProjectRootDbPath(symlinkPath);
assertEq(
  symlinkResult,
  join("/home/user/myproject/.gwd/projects/abc123def", "gwd.db"),
  "/.gwd/projects/<hash>/worktrees/ resolves to external project state DB",
);

// Windows-style separators for symlink layout
if (sep === "\\") {
  const winSymlinkPath = `C:\\Users\\dev\\project\\.gwd\\projects\\abc123def\\worktrees\\M001\\work`;
  const winResult = resolveProjectRootDbPath(winSymlinkPath);
  assertEq(
    winResult,
    join("C:\\Users\\dev\\project\\.gwd\\projects\\abc123def", "gwd.db"),
    "Windows /.gwd/projects/<hash>/worktrees/ resolves to external project state DB",
  );
} else {
  // On non-Windows, test forward-slash variant explicitly
  const fwdSymlinkPath = `/home/user/myproject/.gwd/projects/abc123def/worktrees/M001/work`;
  const fwdResult = resolveProjectRootDbPath(fwdSymlinkPath);
  assertEq(
    fwdResult,
    join("/home/user/myproject/.gwd/projects/abc123def", "gwd.db"),
    "Forward-slash /.gwd/projects/<hash>/worktrees/ resolves to external project state DB on POSIX",
  );
}

// Edge: deeper nesting under projects/<hash>/worktrees
const deepSymlinkPath = `/home/user/myproject/.gwd/projects/deadbeef42/worktrees/M003/sub/dir`;
const deepResult = resolveProjectRootDbPath(deepSymlinkPath);
assertEq(
  deepResult,
  join("/home/user/myproject/.gwd/projects/deadbeef42", "gwd.db"),
  "Deep /.gwd/projects/<hash>/worktrees/ path resolves to external project state DB",
);

// Non-worktree path should be unchanged
const normalPath = `/home/user/myproject`;
const normalResult = resolveProjectRootDbPath(normalPath);
assertEq(
  normalResult,
  join("/home/user/myproject", ".gwd", "gwd.db"),
  "Non-worktree path is unchanged",
);

// Source-grep checks for ensureDbOpen diagnostics + post-unit retry guard
// were removed (#4826) — the behavioural retry-loop tests live in
// auto-post-unit.test.ts and exercise isDbAvailable() directly.

report();
