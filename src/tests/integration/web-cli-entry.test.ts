import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const { resolveGwdCliEntry } = await import("../../web/cli-entry.ts");

function makeFixture(paths: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "gwd-cli-entry-"));
  for (const relativePath of paths) {
    const fullPath = join(root, relativePath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, "// fixture\n");
  }
  return root;
}

test("resolveGwdCliEntry prefers the built loader for packaged standalone interactive sessions", (t) => {
  const packageRoot = makeFixture([
    "dist/loader.js",
    "src/loader.ts",
    "src/resources/extensions/gwd/tests/resolve-ts.mjs",
  ]);

  t.after(() => { rmSync(packageRoot, { recursive: true, force: true }); });

  const entry = resolveGwdCliEntry({
    packageRoot,
    cwd: "/tmp/project-a",
    execPath: "/custom/node",
    hostKind: "packaged-standalone",
    mode: "interactive",
  });

  assert.deepEqual(entry, {
    command: "/custom/node",
    args: [join(packageRoot, "dist", "loader.js")],
    cwd: "/tmp/project-a",
  });
});

test("resolveGwdCliEntry prefers the source loader for source-dev interactive sessions", (t) => {
  const packageRoot = makeFixture([
    "dist/loader.js",
    "src/loader.ts",
    "src/resources/extensions/gwd/tests/resolve-ts.mjs",
  ]);

  t.after(() => { rmSync(packageRoot, { recursive: true, force: true }); });

  const entry = resolveGwdCliEntry({
    packageRoot,
    cwd: "/tmp/project-b",
    execPath: "/custom/node",
    hostKind: "source-dev",
    mode: "interactive",
  });

  assert.deepEqual(entry, {
    command: "/custom/node",
    args: [
      "--import",
      pathToFileURL(join(packageRoot, "src", "resources", "extensions", "gwd", "tests", "resolve-ts.mjs")).href,
      "--experimental-strip-types",
      join(packageRoot, "src", "loader.ts"),
    ],
    cwd: "/tmp/project-b",
  });
});

test("resolveGwdCliEntry appends rpc arguments for bridge sessions", (t) => {
  const packageRoot = makeFixture(["dist/loader.js"]);

  t.after(() => { rmSync(packageRoot, { recursive: true, force: true }); });

  const entry = resolveGwdCliEntry({
    packageRoot,
    cwd: "/tmp/project-c",
    execPath: "/custom/node",
    hostKind: "packaged-standalone",
    mode: "rpc",
    sessionDir: "/tmp/.gwd/sessions/project-c",
  });

  assert.deepEqual(entry, {
    command: "/custom/node",
    args: [
      join(packageRoot, "dist", "loader.js"),
      "--mode",
      "rpc",
      "--continue",
      "--session-dir",
      "/tmp/.gwd/sessions/project-c",
    ],
    cwd: "/tmp/project-c",
  });
});
