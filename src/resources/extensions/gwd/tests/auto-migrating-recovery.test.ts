import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { recoverFailedMigration } from "../migrate-external.ts";

// Regression tests for #4416: `.gwd.migrating` must be healed before auto-mode
// proceeds, including on the resume path in auto.ts (fixed at auto.ts:1325).
// The `recoverFailedMigration` function is already called in `auto-start.ts:350`
// for fresh-start sessions. The fix adds an identical call to `auto.ts:startAuto`
// so that resume sessions (triggered by a persisted paused-session.json) also heal
// a leftover `.gwd.migrating` directory before acquiring the session lock.

test("recoverFailedMigration renames .gwd.migrating to .gwd when .gwd is absent", (t) => {
  const base = mkdtempSync(join(tmpdir(), "gsd-migrating-recovery-"));
  t.after(() => rmSync(base, { recursive: true, force: true }));

  const migratingPath = join(base, ".gwd.migrating");
  mkdirSync(join(migratingPath, "milestones"), { recursive: true });

  const recovered = recoverFailedMigration(base);

  assert.equal(recovered, true, "expected recovery to succeed");
  assert.ok(existsSync(join(base, ".gwd")), ".gwd must exist after recovery");
  assert.ok(!existsSync(migratingPath), ".gwd.migrating must not exist after recovery");
});

test("recoverFailedMigration returns false when .gwd.migrating is absent (nothing to do)", (t) => {
  const base = mkdtempSync(join(tmpdir(), "gsd-migrating-noop-"));
  t.after(() => rmSync(base, { recursive: true, force: true }));

  const recovered = recoverFailedMigration(base);
  assert.equal(recovered, false, "no migration to recover");
});

test("recoverFailedMigration returns false when both .gwd and .gwd.migrating exist (ambiguous)", (t) => {
  const base = mkdtempSync(join(tmpdir(), "gsd-migrating-ambig-"));
  t.after(() => rmSync(base, { recursive: true, force: true }));

  mkdirSync(join(base, ".gwd"), { recursive: true });
  mkdirSync(join(base, ".gwd.migrating"), { recursive: true });

  const recovered = recoverFailedMigration(base);
  assert.equal(recovered, false, "should not touch ambiguous state");
  assert.ok(existsSync(join(base, ".gwd")), ".gwd must still exist");
  assert.ok(existsSync(join(base, ".gwd.migrating")), ".gwd.migrating must still exist");
});

test("recoverFailedMigration preserves contents of .gwd.migrating", (t) => {
  const base = mkdtempSync(join(tmpdir(), "gsd-migrating-contents-"));
  t.after(() => rmSync(base, { recursive: true, force: true }));

  const migratingPath = join(base, ".gwd.migrating");
  mkdirSync(join(migratingPath, "milestones", "M001"), { recursive: true });
  writeFileSync(join(migratingPath, "milestones", "M001", "M001-ROADMAP.md"), "# M001\n");

  recoverFailedMigration(base);

  const roadmap = join(base, ".gwd", "milestones", "M001", "M001-ROADMAP.md");
  assert.ok(existsSync(roadmap), "Milestone file must be accessible via .gwd after recovery");
});
