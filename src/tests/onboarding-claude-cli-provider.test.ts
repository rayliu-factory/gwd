import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const resolveTsPath = join(process.cwd(), "src", "resources", "extensions", "gwd", "tests", "resolve-ts.mjs")

test("onboarding claude-cli path persists defaultProvider to settings.json", (t) => {
  const gwdHome = mkdtempSync(join(tmpdir(), "gwd-onboarding-claude-cli-"))
  t.after(() => rmSync(gwdHome, { recursive: true, force: true }))

  execFileSync(
    process.execPath,
    [
      "--import",
      resolveTsPath,
      "--experimental-strip-types",
      "--input-type=module",
      "--eval",
      `
        const { runLlmStep } = await import(${JSON.stringify(join(process.cwd(), "src", "onboarding.ts"))});
        const p = {
          select: async () => "claude-cli",
          isCancel: () => false,
          log: { success() {}, info() {}, warn() {}, step() {} },
          spinner: () => ({ start() {}, stop() {} }),
        };
        const pc = new Proxy({}, { get: () => (value) => value });
        const authStorage = {
          getOAuthProviders: () => [],
          hasAuth: () => false,
          set(provider, value) {
            if (provider !== "claude-code" || value.key !== "cli") throw new Error("claude-code auth sentinel not stored");
          },
        };
        const configured = await runLlmStep(p, pc, authStorage);
        if (!configured) throw new Error("claude-cli onboarding did not complete");
      `,
    ],
    { env: { ...process.env, GWD_HOME: gwdHome }, stdio: "pipe" },
  )

  const settings = JSON.parse(readFileSync(join(gwdHome, "agent", "settings.json"), "utf-8"))
  assert.equal(settings.defaultProvider, "claude-code")
})
