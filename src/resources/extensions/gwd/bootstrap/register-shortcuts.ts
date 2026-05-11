import { existsSync } from "node:fs";
import { join } from "node:path";

import type { ExtensionAPI, ExtensionContext } from "@gwd/pi-coding-agent";
import { Key } from "@gwd/pi-tui";

import { GWD_SHORTCUTS } from "../shortcut-defs.js";
import { shortcutDesc } from "../../shared/mod.js";

async function getProjectRoot(): Promise<string> {
  const { projectRoot } = await import("../commands/context.js");
  return projectRoot();
}

export function registerShortcuts(pi: ExtensionAPI): void {
  const overlayOptions = {
    width: "90%",
    minWidth: 80,
    maxHeight: "92%",
    anchor: "center",
  } as const;

  const openDashboardOverlay = async (ctx: ExtensionContext) => {
    const [{ GSDDashboardOverlay }, basePath] = await Promise.all([
      import("../dashboard-overlay.js"),
      getProjectRoot(),
    ]);
    if (!existsSync(join(basePath, ".gwd"))) {
      ctx.ui.notify("No .gwd/ directory found. Run /gwd to start.", "info");
      return;
    }
    await ctx.ui.custom<boolean>(
      (tui, theme, _kb, done) => new GSDDashboardOverlay(tui, theme, () => done(true)),
      {
        overlay: true,
        overlayOptions,
      },
    );
  };

  const openNotificationsOverlay = async (ctx: ExtensionContext) => {
    const { GSDNotificationOverlay } = await import("../notification-overlay.js");
    await ctx.ui.custom<boolean>(
      (tui, theme, _kb, done) => new GSDNotificationOverlay(tui, theme, () => done(true)),
      {
        overlay: true,
        overlayOptions: {
          width: "80%",
          minWidth: 60,
          maxHeight: "88%",
          anchor: "center",
          backdrop: true,
        },
      },
    );
  };

  const openParallelOverlay = async (ctx: ExtensionContext) => {
    const basePath = await getProjectRoot();
    const parallelDir = join(basePath, ".gwd", "parallel");
    if (!existsSync(parallelDir)) {
      ctx.ui.notify("No parallel workers found. Run /gwd parallel start first.", "info");
      return;
    }
    const { ParallelMonitorOverlay } = await import("../parallel-monitor-overlay.js");
    await ctx.ui.custom<boolean>(
      (tui, theme, _kb, done) => new ParallelMonitorOverlay(tui, theme, () => done(true), basePath),
      {
        overlay: true,
        overlayOptions,
      },
    );
  };

  pi.registerShortcut(Key.ctrlAlt(GWD_SHORTCUTS.dashboard.key), {
    description: shortcutDesc(GWD_SHORTCUTS.dashboard.action, GWD_SHORTCUTS.dashboard.command),
    handler: openDashboardOverlay,
  });

  // Fallback for terminals where Ctrl+Alt letter chords are not forwarded reliably.
  pi.registerShortcut(Key.ctrlShift(GWD_SHORTCUTS.dashboard.key), {
    description: shortcutDesc(`${GWD_SHORTCUTS.dashboard.action} (fallback)`, GWD_SHORTCUTS.dashboard.command),
    handler: openDashboardOverlay,
  });

  pi.registerShortcut(Key.ctrlAlt(GWD_SHORTCUTS.notifications.key), {
    description: shortcutDesc(GWD_SHORTCUTS.notifications.action, GWD_SHORTCUTS.notifications.command),
    handler: openNotificationsOverlay,
  });

  // Fallback for terminals where Ctrl+Alt letter chords are not forwarded reliably.
  pi.registerShortcut(Key.ctrlShift(GWD_SHORTCUTS.notifications.key), {
    description: shortcutDesc(`${GWD_SHORTCUTS.notifications.action} (fallback)`, GWD_SHORTCUTS.notifications.command),
    handler: openNotificationsOverlay,
  });

  pi.registerShortcut(Key.ctrlAlt(GWD_SHORTCUTS.parallel.key), {
    description: shortcutDesc(GWD_SHORTCUTS.parallel.action, GWD_SHORTCUTS.parallel.command),
    handler: openParallelOverlay,
  });

  // No Ctrl+Shift+P fallback — conflicts with cycleModelBackward (shift+ctrl+p).
  // Use Ctrl+Alt+P or /gwd parallel watch instead.
}
