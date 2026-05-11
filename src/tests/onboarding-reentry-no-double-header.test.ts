import test, { after } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const gwdHome = mkdtempSync(join(tmpdir(), "gwd-onboarding-reentry-"))
process.env.GWD_HOME = gwdHome
const { handleOnboarding } = await import("../resources/extensions/gwd/commands/handlers/onboarding.ts")

after(() => rmSync(gwdHome, { recursive: true, force: true }))

// Regression for #4470: /gwd onboarding re-entry must route through the
// TUI-owned setup hub instead of replaying the first-run clack wizard.

test("re-entry onboarding handler opens the TUI setup hub and routes selected steps", async () => {
  const notifications: Array<{ message: string; level: string }> = []
  const selections: Array<{ message: string; options: string[] }> = []
  const ctx = {
    ui: {
      notify(message: string, level: string) {
        notifications.push({ message, level })
      },
      async select(message: string, options: string[]) {
        selections.push({ message, options })
        return options.find((option) => option.includes("LLM")) ?? options[0]
      },
    },
  }

  await handleOnboarding("", ctx as any)

  assert.equal(selections.length, 1)
  assert.equal(selections[0].message, "GWD Setup — pick a step to configure")
  assert.ok(selections[0].options.some((option) => option.includes("LLM")))
  assert.equal(notifications.length, 1)
  assert.match(notifications[0].message, /LLM provider setup/)
  assert.equal(notifications[0].level, "info")
})
