// Project/App: GWD
// File Purpose: Pure spawn planning for the VS Code GWD RPC client.

import type { SpawnOptions } from "node:child_process";

export interface GwdClientSpawnPlan {
	command: string;
	args: string[];
	options: SpawnOptions;
}

export function buildGwdClientSpawnPlan(
	binaryPath: string,
	cwd: string,
	env: NodeJS.ProcessEnv = process.env,
	platform: NodeJS.Platform = process.platform,
): GwdClientSpawnPlan {
	return {
		command: binaryPath,
		args: ["--mode", "rpc"],
		options: {
			cwd,
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...env },
			shell: platform === "win32",
		},
	};
}
