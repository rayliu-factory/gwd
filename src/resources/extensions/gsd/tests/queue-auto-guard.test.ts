/**
 * Tests that /gwd queue is blocked when auto-mode is active.
 *
 * Relates to #4704: /gwd queue writes .gsd/PROJECT.md + QUEUE-ORDER.json
 * directly into the project-root worktree, racing with auto-mode's
 * pre-merge dirty-tree check and causing __dirty_working_tree__ failures.
 *
 * The fix adds an isAutoActive() guard in handleWorkflowCommand before
 * delegating to showQueue, mirroring the existing /gwd quick guard (#2417).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { _setAutoActiveForTest } from "../auto.ts";
import { handleWorkflowCommand } from "../commands/handlers/workflow.ts";

describe("/gwd queue auto-mode guard (#4704)", () => {
  it("returns handled and notifies when auto-mode is active", async () => {
    const notifications: Array<{ message: string; level?: string }> = [];
    _setAutoActiveForTest(true);
    try {
      const handled = await handleWorkflowCommand("queue", {
        ui: {
          notify(message: string, level?: string) {
            notifications.push({ message, level });
          },
        },
      } as any, {} as any);

      assert.equal(handled, true);
      assert.deepEqual(notifications, [{
        message: "/gwd queue cannot run while auto-mode is active.\nStop auto-mode first with /gwd stop, then run /gwd queue.",
        level: "error",
      }]);
    } finally {
      _setAutoActiveForTest(false);
    }
  });
});
