// Project/App: GWD
// File Purpose: VS Code extension activation and command registration for GWD.

import * as vscode from "vscode";
import { pickTrustedConfigurationValue } from "./trusted-config.js";
import { GwdClient, ThinkingLevel } from "./gwd-client.js";
import { registerChatParticipant } from "./chat-participant.js";
import { GwdSidebarProvider } from "./sidebar.js";
import { GwdFileDecorationProvider } from "./file-decorations.js";
import { GwdBashTerminal } from "./bash-terminal.js";
import { GwdSessionTreeProvider } from "./session-tree.js";
import { GwdConversationHistoryPanel } from "./conversation-history.js";
import { GwdSlashCompletionProvider } from "./slash-completion.js";
import { GwdCodeLensProvider } from "./code-lens.js";
import { GwdActivityFeedProvider } from "./activity-feed.js";
import { GwdChangeTracker } from "./change-tracker.js";
import { GwdScmProvider } from "./scm-provider.js";
import { GwdDiagnosticBridge } from "./diagnostics.js";
import { GwdLineDecorationManager } from "./line-decorations.js";
import { GwdGitIntegration } from "./git-integration.js";
import { GwdPermissionManager } from "./permissions.js";
import { GwdPlanViewerProvider } from "./plan-viewer.js";
import { GwdCheckpointProvider } from "./checkpoints.js";
import {
	formatSessionStatsLines,
	getBashExitCode,
	getBashOutput,
	getSessionCost,
	getSessionTotalTokens,
} from "./rpc-display.js";

let client: GwdClient | undefined;
let sidebarProvider: GwdSidebarProvider | undefined;
let fileDecorations: GwdFileDecorationProvider | undefined;
let sessionTreeProvider: GwdSessionTreeProvider | undefined;
let activityFeedProvider: GwdActivityFeedProvider | undefined;
let planViewerProvider: GwdPlanViewerProvider | undefined;
let checkpointProvider: GwdCheckpointProvider | undefined;
let changeTracker: GwdChangeTracker | undefined;
let scmProvider: GwdScmProvider | undefined;
let diagnosticBridge: GwdDiagnosticBridge | undefined;
let lineDecorations: GwdLineDecorationManager | undefined;
let gitIntegration: GwdGitIntegration | undefined;
let permissionManager: GwdPermissionManager | undefined;

function getTrustedConfigurationValue<T>(section: string, key: string, fallback: T): T {
	const config = vscode.workspace.getConfiguration(section);
	return pickTrustedConfigurationValue(config.inspect<T>(key), fallback);
}

export function resolveTrustedGwdStartupConfig(): { binaryPath: string; autoStart: boolean } {
	return {
		binaryPath: getTrustedConfigurationValue("gwd", "binaryPath", "gwd"),
		autoStart: getTrustedConfigurationValue("gwd", "autoStart", false),
	};
}

function requireConnected(): boolean {
	if (!client?.isConnected) {
		vscode.window.showWarningMessage("GWD agent is not running.");
		return false;
	}
	return true;
}

function handleError(err: unknown, context: string): void {
	const msg = err instanceof Error ? err.message : String(err);
	vscode.window.showErrorMessage(`${context}: ${msg}`);
}

export function activate(context: vscode.ExtensionContext): void {
	const startupConfig = resolveTrustedGwdStartupConfig();
	const config = vscode.workspace.getConfiguration("gwd");
	const binaryPath = startupConfig.binaryPath;
	const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();

	client = new GwdClient(binaryPath, cwd);
	context.subscriptions.push(client);

	// Log stderr to an output channel
	const outputChannel = vscode.window.createOutputChannel("GWD Agent");
	context.subscriptions.push(outputChannel);

	client.onError((msg) => {
		outputChannel.appendLine(`[stderr] ${msg}`);
	});

	// -- Persistent status bar item ----------------------------------------

	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	statusBarItem.command = "workbench.view.extension.gwd";
	statusBarItem.text = "$(hubot) GWD";
	statusBarItem.tooltip = "GWD Agent — click to open";
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	async function refreshStatusBar(): Promise<void> {
		if (!client?.isConnected) {
			statusBarItem.text = "$(hubot) GWD";
			statusBarItem.tooltip = "GWD: Disconnected";
			return;
		}
		try {
			const [state, stats] = await Promise.all([
				client.getState().catch(() => null),
				client.getSessionStats().catch(() => null),
			]);
			const modelId = state?.model?.id ?? "";
			const cost = getSessionCost(stats);
			const costPart = cost > 0 ? ` | $${cost.toFixed(4)}` : "";
			const streamPart = state?.isStreaming ? " $(sync~spin)" : "";
			statusBarItem.text = `$(hubot) GWD${modelId ? ` | ${modelId}` : ""}${costPart}${streamPart}`;
			statusBarItem.tooltip = state?.model
				? `GWD: Connected — ${state.model.provider}/${state.model.id}`
				: "GWD: Connected";
		} catch {
			// ignore fetch errors
		}
	}

	const statusBarTimer = setInterval(() => refreshStatusBar(), 10_000);
	context.subscriptions.push({ dispose: () => clearInterval(statusBarTimer) });

	client.onConnectionChange(async (connected) => {
		await refreshStatusBar();
		if (connected) {
			vscode.window.setStatusBarMessage("$(hubot) GWD connected", 3000);
		} else {
			vscode.window.setStatusBarMessage("$(hubot) GWD disconnected", 3000);
		}
	});

	// -- Sidebar -----------------------------------------------------------

	sidebarProvider = new GwdSidebarProvider(context.extensionUri, client);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			GwdSidebarProvider.viewId,
			sidebarProvider,
		),
	);

	// -- File decorations --------------------------------------------------

	fileDecorations = new GwdFileDecorationProvider(client);
	context.subscriptions.push(
		fileDecorations,
		vscode.window.registerFileDecorationProvider(fileDecorations),
	);

	// -- Bash terminal -----------------------------------------------------

	const bashTerminal = new GwdBashTerminal(client);
	context.subscriptions.push(bashTerminal);

	// -- Session tree view -------------------------------------------------

	sessionTreeProvider = new GwdSessionTreeProvider(client);
	context.subscriptions.push(
		sessionTreeProvider,
		vscode.window.registerTreeDataProvider(GwdSessionTreeProvider.viewId, sessionTreeProvider),
	);

	// -- Activity feed -----------------------------------------------------

	activityFeedProvider = new GwdActivityFeedProvider(client);
	context.subscriptions.push(
		activityFeedProvider,
		vscode.window.registerTreeDataProvider(GwdActivityFeedProvider.viewId, activityFeedProvider),
	);

	// -- Plan view ----------------------------------------------------------

	planViewerProvider = new GwdPlanViewerProvider(client);
	context.subscriptions.push(
		planViewerProvider,
		vscode.window.registerTreeDataProvider(GwdPlanViewerProvider.viewId, planViewerProvider),
	);

	// -- Change tracker & SCM provider -------------------------------------

	changeTracker = new GwdChangeTracker(client, cwd);
	context.subscriptions.push(changeTracker);

	checkpointProvider = new GwdCheckpointProvider(changeTracker);
	context.subscriptions.push(
		checkpointProvider,
		vscode.window.registerTreeDataProvider(GwdCheckpointProvider.viewId, checkpointProvider),
	);

	scmProvider = new GwdScmProvider(changeTracker, cwd);
	context.subscriptions.push(scmProvider);

	// -- Diagnostics -------------------------------------------------------

	diagnosticBridge = new GwdDiagnosticBridge(client);
	context.subscriptions.push(diagnosticBridge);

	// -- Line-level decorations --------------------------------------------

	lineDecorations = new GwdLineDecorationManager(changeTracker!);
	context.subscriptions.push(lineDecorations);

	// -- Git integration ---------------------------------------------------

	gitIntegration = new GwdGitIntegration(changeTracker!, cwd);
	context.subscriptions.push(gitIntegration);

	// -- Permissions -------------------------------------------------------

	permissionManager = new GwdPermissionManager(client);
	context.subscriptions.push(permissionManager);

	// -- Progress notifications --------------------------------------------

	let currentProgress: { resolve: () => void } | undefined;

	client.onEvent((evt) => {
		const showProgress = vscode.workspace.getConfiguration("gwd").get<boolean>("showProgressNotifications", true);
		if (!showProgress) return;

		if (evt.type === "agent_start" && !currentProgress) {
			vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: "GWD Agent",
					cancellable: true,
				},
				(progress, token) => {
					token.onCancellationRequested(() => {
						client?.abort().catch(() => {});
					});

					// Listen for tool events to update progress message
					const toolListener = client!.onEvent((toolEvt) => {
						if (toolEvt.type === "tool_execution_start") {
							const toolName = String(toolEvt.toolName ?? "");
							progress.report({ message: `Running ${toolName}...` });
						}
					});

					return new Promise<void>((resolve) => {
						currentProgress = { resolve };
						// Also clean up if disposed
						token.onCancellationRequested(() => {
							toolListener.dispose();
							currentProgress = undefined;
							resolve();
						});
					}).finally(() => {
						toolListener.dispose();
					});
				},
			);
		} else if (evt.type === "agent_end" && currentProgress) {
			currentProgress.resolve();
			currentProgress = undefined;
		}
	});

	// -- Context window warning --------------------------------------------

	let lastContextWarning = 0;
	client.onEvent(async (evt) => {
		if (evt.type !== "message_end") return;
		const showWarning = vscode.workspace.getConfiguration("gwd").get<boolean>("showContextWarning", true);
		if (!showWarning) return;

		// Throttle: at most once per 60 seconds
		if (Date.now() - lastContextWarning < 60_000) return;

		try {
			const [state, stats] = await Promise.all([
				client!.getState().catch(() => null),
				client!.getSessionStats().catch(() => null),
			]);
			const contextWindow = state?.model?.contextWindow ?? 0;
			const totalTokens = getSessionTotalTokens(stats);
			if (contextWindow <= 0) return;

			const threshold = vscode.workspace.getConfiguration("gwd").get<number>("contextWarningThreshold", 80);
			const pct = Math.round((totalTokens / contextWindow) * 100);
			if (pct >= threshold) {
				lastContextWarning = Date.now();
				const action = await vscode.window.showWarningMessage(
					`Context window ${pct}% full (${Math.round(totalTokens / 1000)}k / ${Math.round(contextWindow / 1000)}k). Consider compacting.`,
					"Compact Now",
				);
				if (action === "Compact Now") {
					await vscode.commands.executeCommand("gwd.compact");
				}
			}
		} catch {
			// ignore
		}
	});

	// -- Chat participant ---------------------------------------------------

	context.subscriptions.push(registerChatParticipant(context, client));

	// -- Conversation history panel ----------------------------------------

	// (panel is created on demand via gwd.showHistory command)

	// -- Slash command completion ------------------------------------------

	const slashCompletion = new GwdSlashCompletionProvider(client);
	context.subscriptions.push(
		slashCompletion,
		vscode.languages.registerCompletionItemProvider(
			[
				{ language: "markdown" },
				{ language: "plaintext" },
				{ language: "typescript" },
				{ language: "typescriptreact" },
				{ language: "javascript" },
				{ language: "javascriptreact" },
			],
			slashCompletion,
			"/",
		),
	);

	// -- Code lens "Ask GWD" -----------------------------------------------

	const codeLensProvider = new GwdCodeLensProvider(client);
	context.subscriptions.push(
		codeLensProvider,
		vscode.languages.registerCodeLensProvider(
			[
				{ language: "typescript" },
				{ language: "typescriptreact" },
				{ language: "javascript" },
				{ language: "javascriptreact" },
				{ language: "python" },
				{ language: "go" },
				{ language: "rust" },
			],
			codeLensProvider,
		),
	);

	// -- Commands -----------------------------------------------------------

	// Start
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.start", async () => {
			try {
				await client!.start();
				// Apply auto-compaction setting
				const autoCompaction = vscode.workspace.getConfiguration("gwd").get<boolean>("autoCompaction", true);
				await client!.setAutoCompaction(autoCompaction).catch(() => {});
				sidebarProvider?.refresh();
				refreshStatusBar();
				vscode.window.showInformationMessage("GWD agent started.");
			} catch (err) {
				handleError(err, "Failed to start GWD");
			}
		}),
	);

	// Stop
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.stop", async () => {
			await client!.stop();
			sidebarProvider?.refresh();
			vscode.window.showInformationMessage("GWD agent stopped.");
		}),
	);

	// New Session
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.newSession", async () => {
			if (!requireConnected()) return;
			try {
				await client!.newSession();
				sidebarProvider?.refresh();
				sessionTreeProvider?.refresh();
				fileDecorations?.clear();
				vscode.window.showInformationMessage("New GWD session started.");
			} catch (err) {
				handleError(err, "Failed to start new session");
			}
		}),
	);

	// Send Message
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.sendMessage", async () => {
			if (!requireConnected()) return;
			const message = await vscode.window.showInputBox({
				prompt: "Enter message for GWD",
				placeHolder: "What should I do?",
			});
			if (!message) return;
			try {
				await client!.sendPrompt(message);
			} catch (err) {
				handleError(err, "Failed to send message");
			}
		}),
	);

	// Abort
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.abort", async () => {
			if (!requireConnected()) return;
			try {
				await client!.abort();
				vscode.window.showInformationMessage("Operation aborted.");
			} catch (err) {
				handleError(err, "Failed to abort");
			}
		}),
	);

	// Cycle Model
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.cycleModel", async () => {
			if (!requireConnected()) return;
			try {
				const result = await client!.cycleModel();
				if (result) {
					vscode.window.showInformationMessage(
						`Model: ${result.model.provider}/${result.model.id} (thinking: ${result.thinkingLevel})`,
					);
				} else {
					vscode.window.showInformationMessage("No other models available.");
				}
				sidebarProvider?.refresh();
			} catch (err) {
				handleError(err, "Failed to cycle model");
			}
		}),
	);

	// Switch Model (QuickPick)
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.switchModel", async () => {
			if (!requireConnected()) return;
			try {
				const models = await client!.getAvailableModels();
				if (models.length === 0) {
					vscode.window.showInformationMessage("No models available.");
					return;
				}
				const items = models.map((m) => ({
					label: `${m.provider}/${m.id}`,
					description: m.contextWindow ? `${Math.round(m.contextWindow / 1000)}k context` : undefined,
					provider: m.provider,
					modelId: m.id,
				}));
				const selected = await vscode.window.showQuickPick(items, {
					placeHolder: "Select a model",
				});
				if (!selected) return;
				await client!.setModel(selected.provider, selected.modelId);
				vscode.window.showInformationMessage(`Model set to ${selected.label}`);
				sidebarProvider?.refresh();
			} catch (err) {
				handleError(err, "Failed to switch model");
			}
		}),
	);

	// Cycle Thinking Level
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.cycleThinking", async () => {
			if (!requireConnected()) return;
			try {
				const result = await client!.cycleThinkingLevel();
				if (result) {
					vscode.window.showInformationMessage(`Thinking level: ${result.level}`);
				} else {
					vscode.window.showInformationMessage("Cannot change thinking level for this model.");
				}
				sidebarProvider?.refresh();
			} catch (err) {
				handleError(err, "Failed to cycle thinking level");
			}
		}),
	);

	// Set Thinking Level (QuickPick)
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.setThinking", async () => {
			if (!requireConnected()) return;
			const levels: ThinkingLevel[] = ["off", "low", "medium", "high"];
			const selected = await vscode.window.showQuickPick(levels, {
				placeHolder: "Select thinking level",
			});
			if (!selected) return;
			try {
				await client!.setThinkingLevel(selected as ThinkingLevel);
				vscode.window.showInformationMessage(`Thinking level set to ${selected}`);
				sidebarProvider?.refresh();
			} catch (err) {
				handleError(err, "Failed to set thinking level");
			}
		}),
	);

	// Compact Context
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.compact", async () => {
			if (!requireConnected()) return;
			try {
				await client!.compact();
				vscode.window.showInformationMessage("Context compacted.");
				sidebarProvider?.refresh();
			} catch (err) {
				handleError(err, "Failed to compact context");
			}
		}),
	);

	// Export HTML
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.exportHtml", async () => {
			if (!requireConnected()) return;
			try {
				const saveUri = await vscode.window.showSaveDialog({
					defaultUri: vscode.Uri.file("gwd-conversation.html"),
					filters: { "HTML Files": ["html"] },
				});
				const outputPath = saveUri?.fsPath;
				const result = await client!.exportHtml(outputPath);
				vscode.window.showInformationMessage(`Conversation exported to ${result.path}`);
			} catch (err) {
				handleError(err, "Failed to export HTML");
			}
		}),
	);

	// Session Stats
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.sessionStats", async () => {
			if (!requireConnected()) return;
			try {
				const stats = await client!.getSessionStats();
				const lines = formatSessionStatsLines(stats);

				vscode.window.showInformationMessage(
					lines.length > 0 ? lines.join(" | ") : "No stats available.",
				);
			} catch (err) {
				handleError(err, "Failed to get session stats");
			}
		}),
	);

	// Run Bash Command
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.runBash", async () => {
			if (!requireConnected()) return;
			const command = await vscode.window.showInputBox({
				prompt: "Enter bash command to execute",
				placeHolder: "ls -la",
			});
			if (!command) return;
			try {
				const result = await client!.runBash(command);
				outputChannel.appendLine(`[bash] $ ${command}`);
				const output = getBashOutput(result);
				if (output) outputChannel.appendLine(output);
				outputChannel.appendLine(`[exit code: ${getBashExitCode(result) ?? "unknown"}]`);
				outputChannel.show(true);

				if (getBashExitCode(result) === 0) {
					vscode.window.showInformationMessage("Bash command completed successfully.");
				} else {
					vscode.window.showWarningMessage(`Bash command exited with code ${getBashExitCode(result) ?? "unknown"}`);
				}
			} catch (err) {
				handleError(err, "Failed to run bash command");
			}
		}),
	);

	// Steer Agent
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.steer", async () => {
			if (!requireConnected()) return;
			const message = await vscode.window.showInputBox({
				prompt: "Enter steering message (interrupts current operation)",
				placeHolder: "Focus on the error handling instead",
			});
			if (!message) return;
			try {
				await client!.steer(message);
			} catch (err) {
				handleError(err, "Failed to steer agent");
			}
		}),
	);

	// List Available Commands
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.listCommands", async () => {
			if (!requireConnected()) return;
			try {
				const commands = await client!.getCommands();
				if (commands.length === 0) {
					vscode.window.showInformationMessage("No slash commands available.");
					return;
				}
				const items = commands.map((cmd) => ({
					label: `/${cmd.name}`,
					description: cmd.description ?? "",
					detail: `Source: ${cmd.source}${cmd.location ? ` (${cmd.location})` : ""}`,
				}));
				const selected = await vscode.window.showQuickPick(items, {
					placeHolder: "Available slash commands",
				});
				if (selected) {
					// Send the selected command as a prompt
					await client!.sendPrompt(selected.label);
				}
			} catch (err) {
				handleError(err, "Failed to list commands");
			}
		}),
	);

	// Switch Session
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.switchSession", async (sessionFile?: string) => {
			if (!requireConnected()) return;
			const file = sessionFile ?? await (async () => {
				const input = await vscode.window.showInputBox({
					prompt: "Enter session file path",
					placeHolder: "/path/to/session.jsonl",
				});
				return input;
			})();
			if (!file) return;
			try {
				await client!.switchSession(file);
				sidebarProvider?.refresh();
				sessionTreeProvider?.refresh();
				vscode.window.showInformationMessage("Switched session.");
			} catch (err) {
				handleError(err, "Failed to switch session");
			}
		}),
	);

	// Refresh Sessions
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.refreshSessions", () => {
			sessionTreeProvider?.refresh();
		}),
	);

	// Show Conversation History
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.showHistory", () => {
			if (!requireConnected()) return;
			GwdConversationHistoryPanel.createOrShow(context.extensionUri, client!);
		}),
	);

	// Ask About Symbol (triggered by code lens)
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"gwd.askAboutSymbol",
			async (symbolName: string, fileName: string, lineNumber: number) => {
				if (!requireConnected()) return;
				try {
					const prompt = `Explain the \`${symbolName}\` function/class in ${fileName} (line ${lineNumber}). Be concise.`;
					await client!.sendPrompt(prompt);
				} catch (err) {
					handleError(err, "Failed to send Ask GWD request");
				}
			},
		),
	);

	// Clear File Decorations
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.clearFileDecorations", () => {
			fileDecorations?.clear();
		}),
	);

	// Clear Activity Feed
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.clearActivity", () => {
			activityFeedProvider?.clear();
		}),
	);

	// Fork Session
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.forkSession", async () => {
			if (!requireConnected()) return;
			try {
				const messages = await client!.getForkMessages();
				if (messages.length === 0) {
					vscode.window.showInformationMessage("No fork points available.");
					return;
				}
				const items = messages.map((m) => ({
					label: m.text.slice(0, 80) + (m.text.length > 80 ? "..." : ""),
					description: m.entryId,
					entryId: m.entryId,
				}));
				const selected = await vscode.window.showQuickPick(items, {
					placeHolder: "Select a message to fork from",
				});
				if (!selected) return;
				const result = await client!.forkSession(selected.entryId);
				if (!result.cancelled) {
					vscode.window.showInformationMessage("Session forked successfully.");
					sidebarProvider?.refresh();
					sessionTreeProvider?.refresh();
				}
			} catch (err) {
				handleError(err, "Failed to fork session");
			}
		}),
	);

	// Toggle Steering Mode
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.toggleSteeringMode", async () => {
			if (!requireConnected()) return;
			try {
				const state = await client!.getState();
				const next = state.steeringMode === "all" ? "one-at-a-time" : "all";
				await client!.setSteeringMode(next);
				vscode.window.showInformationMessage(`Steering mode: ${next}`);
				sidebarProvider?.refresh();
			} catch (err) {
				handleError(err, "Failed to toggle steering mode");
			}
		}),
	);

	// Toggle Follow-Up Mode
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.toggleFollowUpMode", async () => {
			if (!requireConnected()) return;
			try {
				const state = await client!.getState();
				const next = state.followUpMode === "all" ? "one-at-a-time" : "all";
				await client!.setFollowUpMode(next);
				vscode.window.showInformationMessage(`Follow-up mode: ${next}`);
				sidebarProvider?.refresh();
			} catch (err) {
				handleError(err, "Failed to toggle follow-up mode");
			}
		}),
	);

	// Refactor Symbol (code lens)
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"gwd.refactorSymbol",
			async (symbolName: string, fileName: string, lineNumber: number) => {
				if (!requireConnected()) return;
				try {
					await client!.sendPrompt(`Refactor the \`${symbolName}\` function/class in ${fileName} (line ${lineNumber}). Improve clarity, performance, or structure while preserving behavior.`);
				} catch (err) {
					handleError(err, "Failed to send refactor request");
				}
			},
		),
	);

	// Find Bugs in Symbol (code lens)
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"gwd.findBugsSymbol",
			async (symbolName: string, fileName: string, lineNumber: number) => {
				if (!requireConnected()) return;
				try {
					await client!.sendPrompt(`Review the \`${symbolName}\` function/class in ${fileName} (line ${lineNumber}) for potential bugs, edge cases, and issues.`);
				} catch (err) {
					handleError(err, "Failed to send bug review request");
				}
			},
		),
	);

	// Generate Tests for Symbol (code lens)
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"gwd.generateTestsSymbol",
			async (symbolName: string, fileName: string, lineNumber: number) => {
				if (!requireConnected()) return;
				try {
					await client!.sendPrompt(`Generate comprehensive tests for the \`${symbolName}\` function/class in ${fileName} (line ${lineNumber}). Cover success paths, edge cases, and error scenarios.`);
				} catch (err) {
					handleError(err, "Failed to send test generation request");
				}
			},
		),
	);

	// Toggle Auto-Retry
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.toggleAutoRetry", async () => {
			if (!requireConnected()) return;
			try {
				const next = !client!.autoRetryEnabled;
				await client!.setAutoRetry(next);
				vscode.window.showInformationMessage(`Auto-retry ${next ? "enabled" : "disabled"}.`);
				sidebarProvider?.refresh();
			} catch (err) {
				handleError(err, "Failed to toggle auto-retry");
			}
		}),
	);

	// Abort Retry
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.abortRetry", async () => {
			if (!requireConnected()) return;
			try {
				await client!.abortRetry();
				vscode.window.showInformationMessage("Retry aborted.");
			} catch (err) {
				handleError(err, "Failed to abort retry");
			}
		}),
	);

	// Set Session Name
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.setSessionName", async () => {
			if (!requireConnected()) return;
			const name = await vscode.window.showInputBox({
				prompt: "Enter a name for this session",
				placeHolder: "e.g. auth-refactor",
			});
			if (!name) return;
			try {
				await client!.setSessionName(name);
				sidebarProvider?.refresh();
				vscode.window.showInformationMessage(`Session named "${name}".`);
			} catch (err) {
				handleError(err, "Failed to set session name");
			}
		}),
	);

	// Copy Last Response
	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.copyLastResponse", async () => {
			if (!requireConnected()) return;
			try {
				const text = await client!.getLastAssistantText();
				if (!text) {
					vscode.window.showInformationMessage("No response to copy.");
					return;
				}
				await vscode.env.clipboard.writeText(text);
				vscode.window.showInformationMessage("Last response copied to clipboard.");
			} catch (err) {
				handleError(err, "Failed to copy last response");
			}
		}),
	);

	// -- SCM commands -------------------------------------------------------

	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.acceptAllChanges", () => {
			changeTracker?.acceptAll();
			vscode.window.showInformationMessage("All agent changes accepted.");
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.discardAllChanges", async () => {
			if (!changeTracker?.hasChanges) {
				vscode.window.showInformationMessage("No agent changes to discard.");
				return;
			}
			const confirm = await vscode.window.showWarningMessage(
				`Discard all agent changes (${changeTracker.modifiedFiles.length} files)?`,
				{ modal: true },
				"Discard",
			);
			if (confirm === "Discard") {
				const count = await changeTracker.discardAll();
				vscode.window.showInformationMessage(`Reverted ${count} file${count !== 1 ? "s" : ""}.`);
			}
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.discardFileChanges", async (resourceState: vscode.SourceControlResourceState) => {
			if (!changeTracker || !resourceState?.resourceUri) return;
			const filePath = resourceState.resourceUri.fsPath;
			const success = await changeTracker.discardFile(filePath);
			if (success) {
				vscode.window.showInformationMessage(`Reverted ${vscode.workspace.asRelativePath(filePath)}`);
			}
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.acceptFileChanges", (resourceState: vscode.SourceControlResourceState) => {
			if (!changeTracker || !resourceState?.resourceUri) return;
			changeTracker.acceptFile(resourceState.resourceUri.fsPath);
		}),
	);

	// -- Checkpoint commands ------------------------------------------------

	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.restoreCheckpoint", async (checkpointId: number) => {
			if (!changeTracker) return;
			const checkpoint = changeTracker.checkpoints.find((c) => c.id === checkpointId);
			if (!checkpoint) return;

			const confirm = await vscode.window.showWarningMessage(
				`Restore to "${checkpoint.label}"? This will revert files to their state at ${new Date(checkpoint.timestamp).toLocaleTimeString()}.`,
				{ modal: true },
				"Restore",
			);
			if (confirm === "Restore") {
				const count = await changeTracker.restoreCheckpoint(checkpointId);
				vscode.window.showInformationMessage(`Restored ${count} file${count !== 1 ? "s" : ""} to checkpoint.`);
			}
		}),
	);

	// -- Diagnostic commands ------------------------------------------------

	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.fixProblemsInFile", async () => {
			if (!requireConnected()) return;
			try {
				await diagnosticBridge!.fixProblemsInFile();
			} catch (err) {
				handleError(err, "Failed to fix problems");
			}
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.fixAllProblems", async () => {
			if (!requireConnected()) return;
			try {
				await diagnosticBridge!.fixAllProblems();
			} catch (err) {
				handleError(err, "Failed to fix problems");
			}
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.clearDiagnostics", () => {
			diagnosticBridge?.clearFindings();
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.clearPlan", () => {
			planViewerProvider?.clear();
		}),
	);

	// -- Permission commands ------------------------------------------------

	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.cycleApprovalMode", () => {
			permissionManager?.cycleMode();
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.selectApprovalMode", () => {
			permissionManager?.selectMode();
		}),
	);

	// -- Git commands -------------------------------------------------------

	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.commitAgentChanges", () => {
			gitIntegration?.commitAgentChanges();
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.createAgentBranch", () => {
			gitIntegration?.createAgentBranch();
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("gwd.showAgentDiff", () => {
			gitIntegration?.showAgentDiff();
		}),
	);

	// -- Auto-start ---------------------------------------------------------

	if (startupConfig.autoStart) {
		vscode.commands.executeCommand("gwd.start");
	}
}

export function deactivate(): void {
	client?.dispose();
	sidebarProvider?.dispose();
	fileDecorations?.dispose();
	sessionTreeProvider?.dispose();
	activityFeedProvider?.dispose();
	checkpointProvider?.dispose();
	changeTracker?.dispose();
	scmProvider?.dispose();
	diagnosticBridge?.dispose();
	lineDecorations?.dispose();
	gitIntegration?.dispose();
	permissionManager?.dispose();
	client = undefined;
	sidebarProvider = undefined;
	fileDecorations = undefined;
	sessionTreeProvider = undefined;
	activityFeedProvider = undefined;
	checkpointProvider = undefined;
	changeTracker = undefined;
	scmProvider = undefined;
	diagnosticBridge = undefined;
	lineDecorations = undefined;
	gitIntegration = undefined;
	permissionManager = undefined;
}
