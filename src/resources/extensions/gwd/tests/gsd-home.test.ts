/**
 * Tests for gsdHome() — GWD home directory resolution.
 *
 * @see https://github.com/gwd-build/gwd-2/issues/5015
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

describe("gsdHome", () => {
  let savedGwdHome: string | undefined;
  let gsdHome: () => string;

  beforeEach(async () => {
    savedGwdHome = process.env.GWD_HOME;
    const mod = await import("../gwd-home.js");
    gsdHome = mod.gwdHome;
  });

  afterEach(() => {
    if (savedGwdHome !== undefined) {
      process.env.GWD_HOME = savedGwdHome;
    } else {
      delete process.env.GWD_HOME;
    }
  });

  it("returns ~/.gwd by default", () => {
    delete process.env.GWD_HOME;
    assert.equal(gsdHome(), join(homedir(), ".gwd"));
  });

  it("uses GWD_HOME env var when set", () => {
    process.env.GWD_HOME = "/custom/gwd/home";
    // resolve() normalizes to platform absolute path on Windows
    assert.equal(gsdHome(), resolve("/custom/gwd/home"));
  });

  it("returns a non-empty string", () => {
    assert.ok(gsdHome().length > 0);
  });
});
