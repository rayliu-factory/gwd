// GWD Extension — Interactive Routing Bypass Tests

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { resolvePreferredModelConfig } from "../auto-model-selection.ts";

function withRoutingPrefs<T>(fn: () => T): T {
  const originalCwd = process.cwd();
  const originalGwdHome = process.env.GWD_HOME;
  const tempProject = mkdtempSync(join(tmpdir(), "gwd-interactive-routing-"));
  const tempGwdHome = mkdtempSync(join(tmpdir(), "gwd-interactive-routing-home-"));

  try {
    mkdirSync(join(tempProject, ".gwd"), { recursive: true });
    writeFileSync(
      join(tempProject, ".gwd", "PREFERENCES.md"),
      [
        "---",
        "dynamic_routing:",
        "  enabled: true",
        "  tier_models:",
        "    light: gpt-4o-mini",
        "    standard: claude-sonnet-4-6",
        "    heavy: claude-opus-4-6",
        "---",
      ].join("\n"),
      "utf-8",
    );
    process.env.GWD_HOME = tempGwdHome;
    process.chdir(tempProject);
    return fn();
  } finally {
    process.chdir(originalCwd);
    if (originalGwdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = originalGwdHome;
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(tempGwdHome, { recursive: true, force: true });
  }
}

describe("interactive routing bypass (#3962)", () => {
  test("interactive dispatch does not synthesize dynamic routing config", () => {
    withRoutingPrefs(() => {
      const result = resolvePreferredModelConfig(
        "execute-task",
        { provider: "anthropic", id: "claude-sonnet-4-6" },
        false,
      );

      assert.equal(result, undefined);
    });
  });

  test("auto-mode dispatch still synthesizes dynamic routing config", () => {
    withRoutingPrefs(() => {
      const result = resolvePreferredModelConfig(
        "execute-task",
        { provider: "anthropic", id: "claude-sonnet-4-6" },
        true,
      );

      assert.ok(result);
      assert.equal(result!.primary, "claude-opus-4-6");
      assert.equal(result!.source, "synthesized");
    });
  });
});
