/**
 * Tests for gwdHome() — GWD home directory resolution.
 *
 * @see https://github.com/rayliu-factory/gwd/issues/5015
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

describe("gwdHome", () => {
  let savedGwdHome: string | undefined;
  let gwdHome: () => string;

  beforeEach(async () => {
    savedGwdHome = process.env.GWD_HOME;
    const mod = await import("../gwd-home.js");
    gwdHome = mod.gwdHome;
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
    assert.equal(gwdHome(), join(homedir(), ".gwd"));
  });

  it("uses GWD_HOME env var when set", () => {
    process.env.GWD_HOME = "/custom/gwd/home";
    // resolve() normalizes to platform absolute path on Windows
    assert.equal(gwdHome(), resolve("/custom/gwd/home"));
  });

  it("returns a non-empty string", () => {
    assert.ok(gwdHome().length > 0);
  });
});
