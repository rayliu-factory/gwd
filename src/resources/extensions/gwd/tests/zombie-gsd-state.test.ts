/**
 * zombie-gsd-state.test.ts — #2942
 *
 * A partially initialized `.gwd/` (symlink exists but neither `PREFERENCES.md`
 * nor `milestones/` is present) previously caused the init-wizard gate in
 * `showSmartEntry` to be skipped. The fix introduces
 * `hasGsdBootstrapArtifacts`, which requires at least one bootstrap artifact
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

import { hasGsdBootstrapArtifacts } from "../detection.ts";

function makeGsdDir(t: { after: (fn: () => void) => void }): string {
  const dir = mkdtempSync(join(tmpdir(), "gsd-zombie-state-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("#2942: missing .gwd/ directory entirely → treated as un-bootstrapped", () => {
  assert.equal(
    hasGsdBootstrapArtifacts("/nonexistent/path/does/not/exist/.gwd"),
    false,
  );
});

test("#2942: zombie .gwd/ (empty directory) must NOT count as bootstrapped", (t) => {
  const gsd = makeGsdDir(t);
  // Only the directory exists — neither PREFERENCES.md nor milestones/
  assert.equal(
    hasGsdBootstrapArtifacts(gsd),
    false,
    "an empty .gwd/ is a zombie state — init wizard must still run",
  );
});

test("#2942: .gwd/ with PREFERENCES.md counts as bootstrapped", (t) => {
  const gsd = makeGsdDir(t);
  writeFileSync(join(gsd, "PREFERENCES.md"), "# prefs\n");
  assert.equal(hasGsdBootstrapArtifacts(gsd), true);
});

test("#2942: .gwd/ with milestones/ directory counts as bootstrapped", (t) => {
  const gsd = makeGsdDir(t);
  mkdirSync(join(gsd, "milestones"));
  assert.equal(hasGsdBootstrapArtifacts(gsd), true);
});

test("#2942: both artifacts present → bootstrapped", (t) => {
  const gsd = makeGsdDir(t);
  writeFileSync(join(gsd, "PREFERENCES.md"), "# prefs\n");
  mkdirSync(join(gsd, "milestones"));
  assert.equal(hasGsdBootstrapArtifacts(gsd), true);
});

test("#2942: injected existsFn — zombie via predicate is rejected", () => {
  // Only the .gwd/ directory exists; artifacts are missing.
  const existsFn = (p: string) => p === "/proj/.gwd";
  assert.equal(hasGsdBootstrapArtifacts("/proj/.gwd", existsFn), false);
});

test("#2942: injected existsFn — PREFERENCES.md alone is enough", () => {
  const existsFn = (p: string) =>
    p === "/proj/.gwd" || p === "/proj/.gwd/PREFERENCES.md";
  assert.equal(hasGsdBootstrapArtifacts("/proj/.gwd", existsFn), true);
});

test("#2942: injected existsFn — milestones/ alone is enough", () => {
  const existsFn = (p: string) =>
    p === "/proj/.gwd" || p === "/proj/.gwd/milestones";
  assert.equal(hasGsdBootstrapArtifacts("/proj/.gwd", existsFn), true);
});
