/**
 * zombie-gwd-state.test.ts — #2942
 *
 * A partially initialized `.gwd/` (symlink exists but neither `PREFERENCES.md`
 * nor `milestones/` is present) previously caused the init-wizard gate in
 * `showSmartEntry` to be skipped. The fix introduces
 * `hasGwdBootstrapArtifacts`, which requires at least one bootstrap artifact
 * to be present before treating the project as initialized.
 *
 * These tests exercise that helper directly over synthetic filesystems and
 * injected predicates — replacing the old source-grep assertions that only
 * verified the function's *text* shape.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { hasGwdBootstrapArtifacts } from "../detection.ts";

function makeGwdDir(t: { after: (fn: () => void) => void }): string {
  const dir = mkdtempSync(join(tmpdir(), "gwd-zombie-state-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("#2942: missing .gwd/ directory entirely → treated as un-bootstrapped", () => {
  assert.equal(
    hasGwdBootstrapArtifacts("/nonexistent/path/does/not/exist/.gwd"),
    false,
  );
});

test("#2942: zombie .gwd/ (empty directory) must NOT count as bootstrapped", (t) => {
  const gwd = makeGwdDir(t);
  // Only the directory exists — neither PREFERENCES.md nor milestones/
  assert.equal(
    hasGwdBootstrapArtifacts(gwd),
    false,
    "an empty .gwd/ is a zombie state — init wizard must still run",
  );
});

test("#2942: .gwd/ with PREFERENCES.md counts as bootstrapped", (t) => {
  const gwd = makeGwdDir(t);
  writeFileSync(join(gwd, "PREFERENCES.md"), "# prefs\n");
  assert.equal(hasGwdBootstrapArtifacts(gwd), true);
});

test("#2942: .gwd/ with milestones/ directory counts as bootstrapped", (t) => {
  const gwd = makeGwdDir(t);
  mkdirSync(join(gwd, "milestones"));
  assert.equal(hasGwdBootstrapArtifacts(gwd), true);
});

test("#2942: both artifacts present → bootstrapped", (t) => {
  const gwd = makeGwdDir(t);
  writeFileSync(join(gwd, "PREFERENCES.md"), "# prefs\n");
  mkdirSync(join(gwd, "milestones"));
  assert.equal(hasGwdBootstrapArtifacts(gwd), true);
});

test("#2942: injected existsFn — zombie via predicate is rejected", () => {
  // Only the .gwd/ directory exists; artifacts are missing.
  const existsFn = (p: string) => p === "/proj/.gwd";
  assert.equal(hasGwdBootstrapArtifacts("/proj/.gwd", existsFn), false);
});

test("#2942: injected existsFn — PREFERENCES.md alone is enough", () => {
  const existsFn = (p: string) =>
    p === "/proj/.gwd" || p === "/proj/.gwd/PREFERENCES.md";
  assert.equal(hasGwdBootstrapArtifacts("/proj/.gwd", existsFn), true);
});

test("#2942: injected existsFn — milestones/ alone is enough", () => {
  const existsFn = (p: string) =>
    p === "/proj/.gwd" || p === "/proj/.gwd/milestones";
  assert.equal(hasGwdBootstrapArtifacts("/proj/.gwd", existsFn), true);
});
