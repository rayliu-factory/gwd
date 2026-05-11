import type { ExtensionAPI, ExtensionCommandContext } from "@gwd/pi-coding-agent";

import { GWD_COMMAND_DESCRIPTION, getGwdArgumentCompletions } from "./catalog.js";

export function registerGWDCommand(pi: ExtensionAPI): void {
  pi.registerCommand("gwd", {
    description: GWD_COMMAND_DESCRIPTION,
    getArgumentCompletions: getGwdArgumentCompletions,
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const { handleGWDCommand } = await import("./dispatcher.js");
      const { setStderrLoggingEnabled } = await import("../workflow-logger.js");
      const previousStderrSetting = setStderrLoggingEnabled(false);
      try {
        await handleGWDCommand(args, ctx, pi);
      } finally {
        setStderrLoggingEnabled(previousStderrSetting);
      }
    },
  });
}
