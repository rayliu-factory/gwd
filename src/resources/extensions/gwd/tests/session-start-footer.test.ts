/**
 * session-start-footer.test.ts
 *
 * Verifies that register-hooks.ts suppresses the gwd-health widget (not the
 * built-in footer) when isAutoActive() is true, and that setFooter is never
 * called by the extension in either session_start or session_switch.
 *
 * Testing strategy:
 *   1. Source-code regression guards: structural checks on register-hooks.ts.
 *   2. Behavioral integration tests: fire the live session handlers with fake
 *      contexts and confirm footer/widget behavior from runtime effects.
 *
 * Relates to #4314.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { autoSession } from "../auto-runtime-state.ts";
import { registerHooks } from "../bootstrap/register-hooks.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOKS_SOURCE = readFileSync(
  join(__dirname, "..", "bootstrap", "register-hooks.ts"),
  "utf-8",
);

// ─── Source-code regression guards ──────────────────────────────────────────

test("register-hooks.ts does NOT import hideFooter", () => {
  assert.ok(
    !HOOKS_SOURCE.includes("hideFooter"),
    "register-hooks.ts must not reference hideFooter — footer is no longer swapped in auto mode",
  );
});

test("session_start handler guards initHealthWidget with !isAutoActive()", () => {
  const sessionStartIdx = HOOKS_SOURCE.indexOf('"session_start"');
  assert.ok(sessionStartIdx > -1, "session_start handler must exist");

  const sessionSwitchIdx = HOOKS_SOURCE.indexOf('"session_switch"');
  assert.ok(sessionSwitchIdx > sessionStartIdx, "session_switch handler must follow session_start");

  const sessionStartBody = HOOKS_SOURCE.slice(sessionStartIdx, sessionSwitchIdx);

  assert.ok(
    sessionStartBody.includes("isAutoActive()"),
    "session_start handler must call isAutoActive()",
  );
  assert.ok(
    sessionStartBody.includes("initHealthWidget"),
    "session_start handler must reference initHealthWidget",
  );
  assert.ok(
    !sessionStartBody.includes("setFooter"),
    "session_start handler must NOT call setFooter",
  );

  const guardIdx = sessionStartBody.indexOf("isAutoActive()");
  const healthIdx = sessionStartBody.indexOf("initHealthWidget");
  assert.ok(
    guardIdx < healthIdx,
    "isAutoActive() guard must appear before initHealthWidget in session_start",
  );
});

test("session_switch toggles gwd-health from runtime auto state without touching the footer", async (t) => {
  const dir = join(
    tmpdir(),
    `gwd-session-switch-widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  mkdirSync(join(dir, ".gwd"), { recursive: true });
  const tempGwdHome = join(dir, "home");
  mkdirSync(tempGwdHome, { recursive: true });

  const originalCwd = process.cwd();
  const originalGwdHome = process.env.GWD_HOME;
  process.env.GWD_HOME = tempGwdHome;
  process.chdir(dir);
  autoSession.reset();
  t.after(() => {
    autoSession.reset();
    process.chdir(originalCwd);
    if (originalGwdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = originalGwdHome;
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
  });

  const handlers = new Map<string, (event: unknown, ctx: any) => Promise<void> | void>();
  const pi = {
    on(event: string, handler: (event: unknown, ctx: any) => Promise<void> | void) {
      handlers.set(event, handler);
    },
  } as any;

  registerHooks(pi, []);

  const sessionSwitch = handlers.get("session_switch");
  assert.ok(sessionSwitch, "session_switch handler must be registered");

  let setFooterCallCount = 0;
  const widgetCalls: Array<{ key: string; value: unknown }> = [];
  const ctx = {
    hasUI: true,
    ui: {
      notify: () => {},
      setStatus: () => {},
      setFooter: (_footer: unknown) => {
        setFooterCallCount++;
      },
      setWorkingMessage: () => {},
      onTerminalInput: () => () => {},
      setWidget: (key: string, value: unknown) => {
        widgetCalls.push({ key, value });
      },
    },
    sessionManager: { getSessionId: () => null },
    model: null,
    modelRegistry: {
      setDisabledModelProviders: () => {},
      getProviderAuthMode: () => undefined,
      isProviderRequestReady: () => false,
    },
  };

  autoSession.active = true;
  await sessionSwitch!({ reason: "resume" }, ctx);
  assert.deepEqual(
    widgetCalls.filter((call) => call.key === "gwd-health").map((call) => call.value),
    [undefined],
    "session_switch should hide gwd-health when auto is active",
  );
  assert.equal(setFooterCallCount, 0, "session_switch must not call setFooter when auto is active");

  widgetCalls.length = 0;
  autoSession.active = false;
  await sessionSwitch!({ reason: "resume" }, ctx);
  const healthWidgetValues = widgetCalls
    .filter((call) => call.key === "gwd-health")
    .map((call) => call.value);

  assert.ok(healthWidgetValues.length >= 2, "session_switch should initialize gwd-health when auto is inactive");
  assert.ok(
    healthWidgetValues.every((value) => value !== undefined),
    "session_switch must not hide gwd-health when auto is inactive",
  );
  assert.ok(Array.isArray(healthWidgetValues[0]), "initHealthWidget should publish initial health lines");
  assert.equal(typeof healthWidgetValues.at(-1), "function", "initHealthWidget should register the live widget factory");
  assert.equal(setFooterCallCount, 0, "session_switch must not call setFooter when auto is inactive");
});

// ─── Behavioral test: neither setFooter nor health suppression when auto inactive ─

test("session_start does NOT call setFooter or suppress gwd-health when isAutoActive() is false", async (t) => {
  const dir = join(
    tmpdir(),
    `gwd-footer-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  mkdirSync(dir, { recursive: true });

  const originalCwd = process.cwd();
  process.chdir(dir);
  t.after(() => {
    process.chdir(originalCwd);
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
  });

  let setFooterCallCount = 0;
  let healthWidgetHideCount = 0;

  const handlers = new Map<string, (event: unknown, ctx: any) => Promise<void> | void>();
  const pi = {
    on(event: string, handler: (event: unknown, ctx: any) => Promise<void> | void) {
      handlers.set(event, handler);
    },
  } as any;

  registerHooks(pi, []);

  const sessionStart = handlers.get("session_start");
  assert.ok(sessionStart, "session_start handler must be registered");

  await sessionStart!({}, {
    hasUI: true,
    ui: {
      notify: () => {},
      setStatus: () => {},
      setFooter: (_footer: unknown) => {
        setFooterCallCount++;
      },
      setWorkingMessage: () => {},
      onTerminalInput: () => () => {},
      setWidget: (key: string, value: unknown) => {
        if (key === "gwd-health" && value === undefined) healthWidgetHideCount++;
      },
    },
    sessionManager: { getSessionId: () => null },
    model: null,
  } as any);

  assert.equal(setFooterCallCount, 0, "setFooter must NOT be called when isAutoActive() is false");
  assert.equal(healthWidgetHideCount, 0, "gwd-health must NOT be hidden when isAutoActive() is false");
});

test("session_start installs the welcome screen as the TUI header", async (t) => {
  const dir = join(
    tmpdir(),
    `gwd-welcome-header-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  mkdirSync(join(dir, "bin"), { recursive: true });
  mkdirSync(join(dir, "dist"), { recursive: true });
  writeFileSync(join(dir, "bin", "welcome-screen.js"), "export const stale = true;\n", "utf-8");
  writeFileSync(
    join(dir, "dist", "welcome-screen.js"),
    [
      "export function buildWelcomeScreenLines(opts) {",
      "  return [`welcome ${opts.version} ${opts.remoteChannel ?? 'none'} ${opts.width}`];",
      "}",
      "",
    ].join("\n"),
    "utf-8",
  );

  const originalCwd = process.cwd();
  const originalGwdPkgRoot = process.env.GWD_PKG_ROOT;
  const originalGwdBinPath = process.env.GWD_BIN_PATH;
  const originalGwdVersion = process.env.GWD_VERSION;
  const originalFirstRunBanner = process.env.GWD_FIRST_RUN_BANNER;
  process.chdir(dir);
  process.env.GWD_PKG_ROOT = dir;
  process.env.GWD_BIN_PATH = join(dir, "bin", "loader.js");
  process.env.GWD_VERSION = "9.9.9-test";
  delete process.env.GWD_FIRST_RUN_BANNER;
  t.after(() => {
    process.chdir(originalCwd);
    if (originalGwdPkgRoot === undefined) delete process.env.GWD_PKG_ROOT;
    else process.env.GWD_PKG_ROOT = originalGwdPkgRoot;
    if (originalGwdBinPath === undefined) delete process.env.GWD_BIN_PATH;
    else process.env.GWD_BIN_PATH = originalGwdBinPath;
    if (originalGwdVersion === undefined) delete process.env.GWD_VERSION;
    else process.env.GWD_VERSION = originalGwdVersion;
    if (originalFirstRunBanner === undefined) delete process.env.GWD_FIRST_RUN_BANNER;
    else process.env.GWD_FIRST_RUN_BANNER = originalFirstRunBanner;
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
  });

  const handlers = new Map<string, (event: unknown, ctx: any) => Promise<void> | void>();
  const pi = {
    on(event: string, handler: (event: unknown, ctx: any) => Promise<void> | void) {
      handlers.set(event, handler);
    },
  } as any;

  registerHooks(pi, []);

  const sessionStart = handlers.get("session_start");
  assert.ok(sessionStart, "session_start handler must be registered");

  let headerFactory: ((tui: unknown, theme: unknown) => { render(width: number): string[] }) | undefined;
  await sessionStart!({}, {
    hasUI: true,
    ui: {
      notify: () => {},
      setStatus: () => {},
      setFooter: () => {},
      setHeader: (factory: typeof headerFactory) => {
        headerFactory = factory;
      },
      setWorkingMessage: () => {},
      onTerminalInput: () => () => {},
      setWidget: () => {},
    },
    sessionManager: { getSessionId: () => null },
    model: null,
  } as any);

  assert.equal(typeof headerFactory, "function", "session_start should install a header factory");
  const header = headerFactory!({}, {});
  assert.deepEqual(header.render(123), ["welcome 9.9.9-test none 123"]);
});

test("session_start and session_switch apply disabled model provider policy from current preferences", async (t) => {
  const dir = join(
    tmpdir(),
    `gwd-disabled-provider-policy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  mkdirSync(join(dir, ".gwd"), { recursive: true });
  const tempGwdHome = join(dir, "home");
  mkdirSync(tempGwdHome, { recursive: true });

  const originalCwd = process.cwd();
  const originalGwdHome = process.env.GWD_HOME;
  process.env.GWD_HOME = tempGwdHome;
  process.chdir(dir);
  t.after(() => {
    process.chdir(originalCwd);
    if (originalGwdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = originalGwdHome;
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
  });

  const writePrefs = (providers: string[]) => {
    writeFileSync(
      join(dir, ".gwd", "PREFERENCES.md"),
      [
        "---",
        "version: 1",
        "disabled_model_providers:",
        ...providers.map((provider) => `  - ${provider}`),
        "---",
        "",
      ].join("\n"),
      "utf-8",
    );
  };

  const appliedPolicies: string[][] = [];
  const handlers = new Map<string, (event: unknown, ctx: any) => Promise<void> | void>();
  const pi = {
    on(event: string, handler: (event: unknown, ctx: any) => Promise<void> | void) {
      handlers.set(event, handler);
    },
  } as any;
  const ctx = {
    hasUI: true,
    ui: {
      notify: () => {},
      setStatus: () => {},
      setFooter: () => {},
      setWorkingMessage: () => {},
      onTerminalInput: () => () => {},
      setWidget: () => {},
    },
    sessionManager: { getSessionId: () => null },
    model: null,
    modelRegistry: {
      setDisabledModelProviders: (providers: string[]) => {
        appliedPolicies.push([...providers]);
      },
      getProviderAuthMode: () => undefined,
      isProviderRequestReady: () => false,
    },
  };

  registerHooks(pi, []);

  const sessionStart = handlers.get("session_start");
  const sessionSwitch = handlers.get("session_switch");
  assert.ok(sessionStart, "session_start handler must be registered");
  assert.ok(sessionSwitch, "session_switch handler must be registered");

  writePrefs(["google-gemini-cli", " google-gemini-cli ", "openai-codex"]);
  await sessionStart!({}, ctx);
  assert.deepEqual(
    appliedPolicies.at(-1),
    ["google-gemini-cli", "openai-codex"],
    "session_start should apply normalized disabled providers before the first agent turn",
  );

  writePrefs(["anthropic"]);
  await sessionSwitch!({ reason: "resume" }, ctx);
  assert.deepEqual(
    appliedPolicies.at(-1),
    ["anthropic"],
    "session_switch should re-read preferences for the switched project/session context",
  );
});
