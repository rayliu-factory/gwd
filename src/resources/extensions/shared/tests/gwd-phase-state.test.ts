// GWD Shared Phase State Coordination Tests

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	activateGWD,
	configureGWDPhaseAudit,
	deactivateGWD,
	setCurrentPhase,
	clearCurrentPhase,
	isGWDActive,
	getCurrentPhase,
} from "../gwd-phase-state.js";

describe("gwd-phase-state", () => {
	beforeEach(() => {
		deactivateGWD();
	});

	it("tracks active/inactive state", () => {
		assert.equal(isGWDActive(), false);
		activateGWD();
		assert.equal(isGWDActive(), true);
		deactivateGWD();
		assert.equal(isGWDActive(), false);
	});

	it("tracks the current phase when active", () => {
		activateGWD();
		assert.equal(getCurrentPhase(), null);
		assert.equal(setCurrentPhase("plan-milestone"), true);
		assert.equal(getCurrentPhase(), "plan-milestone");
		clearCurrentPhase();
		assert.equal(getCurrentPhase(), null);
	});

	it("rejects phase changes while inactive", () => {
		assert.equal(setCurrentPhase("plan-milestone"), false);
		activateGWD();
		assert.equal(getCurrentPhase(), null);
	});

	it("returns null phase when inactive even if phase was set", () => {
		activateGWD();
		setCurrentPhase("plan-milestone");
		deactivateGWD();
		assert.equal(getCurrentPhase(), null);
	});

	it("deactivation clears the current phase", () => {
		activateGWD();
		setCurrentPhase("execute-task");
		deactivateGWD();
		activateGWD();
		assert.equal(getCurrentPhase(), null);
	});

	it("deactivation clears the audit context so later events do not carry stale trace data", () => {
		const basePath = mkdtempSync(join(tmpdir(), "gwd-phase-state-audit-"));
		try {
			activateGWD({ basePath, traceId: "stale-trace", causedBy: "test" });
			setCurrentPhase("plan-milestone");
			deactivateGWD();

			// Re-activate WITHOUT a context. If deactivate did not clear the
			// stored context, this setCurrentPhase would emit an audit event
			// using "stale-trace".
			activateGWD();
			setCurrentPhase("execute-task");

			const eventsPath = join(basePath, ".gsd", "audit", "events.jsonl");
			if (existsSync(eventsPath)) {
				const contents = readFileSync(eventsPath, "utf-8");
				assert.equal(
					contents.includes("stale-trace") &&
						contents.split("\n").filter((line) => line.includes("stale-trace") && line.includes("execute-task")).length > 0,
					false,
					"execute-task phase change must not be emitted under the deactivated trace",
				);
			}
		} finally {
			configureGWDPhaseAudit(null);
			deactivateGWD();
			rmSync(basePath, { recursive: true, force: true });
		}
	});
});
