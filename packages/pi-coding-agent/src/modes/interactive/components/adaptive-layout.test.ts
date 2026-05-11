// GWD2 - Runtime tests for adaptive terminal layout rendering

import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import stripAnsi from "strip-ansi";
import { AdaptiveLayoutComponent } from "./adaptive-layout.js";
import { initTheme } from "../theme/theme.js";

before(() => {
	initTheme("dark", false);
});

function render(component: AdaptiveLayoutComponent, width: number): string {
	return component.render(width).map(stripAnsi).join("\n");
}

describe("AdaptiveLayoutComponent", () => {
	it("renders workflow command center and inspector on wide terminals", () => {
		const component = new AdaptiveLayoutComponent(() => ({
			override: "workflow",
			activeToolCount: 2,
			gwdPhase: "executing milestone M001",
			sessionName: "demo",
			cwd: "/tmp/demo",
		}));

		const output = render(component, 132);
		assert.match(output, /GWD Command Center/);
		assert.match(output, /signals/);
		assert.match(output, /2 running/);
	});

	it("falls back to a single compact row for narrow workflow terminals", () => {
		const component = new AdaptiveLayoutComponent(() => ({
			override: "workflow",
			activeToolCount: 1,
			gwdPhase: "executing milestone M001",
			cwd: "/tmp/demo",
		}));

		const output = render(component, 68);
		assert.match(output, /GWD compact/);
		assert.doesNotMatch(output, /signals/);
	});

	it("renders blocking failure context in debug mode", () => {
		const component = new AdaptiveLayoutComponent(() => ({
			override: "auto",
			activeToolCount: 0,
			lastError: "Cannot find module @gwd/native",
			cwd: "/tmp/demo",
		}));

		const output = render(component, 120);
		assert.match(output, /blocking failure/);
		assert.match(output, /Cannot find module/);
		assert.match(output, /inspect the failed output/);
	});
});
