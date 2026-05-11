import test from "node:test";
import assert from "node:assert/strict";

import { registerGWDCommand } from "../commands.ts";
import { handleGWDCommand } from "../commands/dispatcher.ts";

function createMockPi() {
  const commands = new Map<string, any>();
  return {
    registerCommand(name: string, options: any) {
      commands.set(name, options);
    },
    registerTool() {},
    registerShortcut() {},
    on() {},
    sendMessage() {},
    commands,
  };
}

function createMockCtx() {
  const notifications: { message: string; level: string }[] = [];
  return {
    notifications,
    ui: {
      notify(message: string, level: string) {
        notifications.push({ message, level });
      },
      custom: async () => {},
    },
    shutdown: async () => {},
  };
}

test("/gwd description includes discuss", () => {
  const pi = createMockPi();
  registerGWDCommand(pi as any);

  const gwd = pi.commands.get("gwd");
  assert.ok(gwd, "registerGWDCommand should register /gwd");
  assert.ok(
    gwd.description.includes("discuss"),
    "description should include discuss",
  );
});

test("/gwd description includes debug", () => {
  const pi = createMockPi();
  registerGWDCommand(pi as any);

  const gwd = pi.commands.get("gwd");
  assert.ok(gwd.description.includes("debug"), "description should include debug");
});

test("/gwd next completions include --debug", () => {
  const pi = createMockPi();
  registerGWDCommand(pi as any);

  const gwd = pi.commands.get("gwd");
  const completions = gwd.getArgumentCompletions("next ");
  const debug = completions.find((c: any) => c.value === "next --debug");
  assert.ok(debug, "next --debug should appear in completions");
});

test("/gwd debug completions include list|status|continue|--diagnose", () => {
  const pi = createMockPi();
  registerGWDCommand(pi as any);

  const gwd = pi.commands.get("gwd");
  const completions = gwd.getArgumentCompletions("debug ");
  const values = completions.map((c: any) => c.value);
  for (const expected of ["debug list", "debug status", "debug continue", "debug --diagnose"]) {
    assert.ok(values.includes(expected), `missing completion: ${expected}`);
  }
});

test("/gwd widget completions include full|small|min|off", () => {
  const pi = createMockPi();
  registerGWDCommand(pi as any);

  const gwd = pi.commands.get("gwd");
  const completions = gwd.getArgumentCompletions("widget ");
  const values = completions.map((c: any) => c.value);
  for (const expected of ["widget full", "widget small", "widget min", "widget off"]) {
    assert.ok(values.includes(expected), `missing completion: ${expected}`);
  }
});

test("/gwd logs completions still include debug after adding /gwd debug", () => {
  const pi = createMockPi();
  registerGWDCommand(pi as any);

  const gwd = pi.commands.get("gwd");
  const completions = gwd.getArgumentCompletions("logs ");
  const values = completions.map((c: any) => c.value);
  assert.ok(values.includes("logs debug"), "logs debug completion should remain available");
});

test("/gwd help full includes /gwd debug command", async () => {
  const ctx = createMockCtx();

  await handleGWDCommand("help full", ctx as any, {} as any);

  const helpText = ctx.notifications.map((n) => n.message).join("\n");
  assert.match(helpText, /\/gwd debug\s+Create\/list\/continue persistent debug sessions/);
});

test("bare /gwd skip shows usage and does not fall through to unknown-command warning", async () => {
  const ctx = createMockCtx();

  await handleGWDCommand("skip", ctx as any, {} as any);

  assert.ok(
    ctx.notifications.some((n) => n.message.includes("Usage: /gwd skip <unit-id>")),
    "should show skip usage guidance",
  );
  assert.ok(
    !ctx.notifications.some((n) => n.message.startsWith("Unknown: /gwd skip")),
    "should not emit unknown-command warning for bare skip",
  );
});
