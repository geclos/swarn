import { Effect, Either } from "effect";
import type { AgentBackend } from "../backend/interface.js";
import type { PromptError, SessionError } from "../models/errors.js";
import type { Task, TaskResult } from "../models/task.js";
import { logError, logWorker } from "../output/logger.js";

const WORKER_SCHEMA = {
	type: "object",
	properties: {
		filesModified: {
			type: "array",
			items: { type: "string" },
			description: "Array of file paths that were created or modified",
		},
		summary: {
			type: "string",
			description:
				"One paragraph describing what was done to complete the task",
		},
	},
	required: ["filesModified", "summary"],
};

function workerPrompt(task: Task): string {
	let prompt = `You are a focused engineer implementing one specific task. Complete the task fully — no TODOs, no placeholders. Follow existing code patterns and conventions. Stay within scope (only modify files relevant to the task). Run tests/lint if available to verify work. When done, summarize what you changed.

## Task #${task.id}: ${task.title}

${task.description}`;

	if (task.filePaths.length > 0) {
		prompt += `\n\n## Target Files\n${task.filePaths.map((f) => `- ${f}`).join("\n")}`;
	}

	if (task.judgeFeedback) {
		prompt += `\n\n## Feedback from Previous Review\nThis task was reviewed and needs revision:\n${task.judgeFeedback}`;
	}

	prompt += `\n\n## Output Format
When you are done, output a JSON object with:
- filesModified: Array of file paths you created or modified
- summary: One paragraph describing what you did to complete the task`;

	return prompt;
}

export type WorkerError = SessionError | PromptError;

export interface WorkerResult {
	taskId: number;
	success: boolean;
	result: TaskResult;
	tokens: { input: number; output: number };
	cost: number;
}

export function executeWorker(
	backend: AgentBackend,
	task: Task,
	workingDir: string,
	model?: { providerID: string; modelID: string } | null,
): Effect.Effect<WorkerResult, never> {
	return Effect.gen(function* () {
		const sessionIdResult = yield* Effect.either(
			backend.createSession({
				title: `swarn-worker: ${task.title}`,
				mode: "build",
				workingDir,
				model: model ?? undefined,
			}),
		);

		if (Either.isLeft(sessionIdResult)) {
			const error = sessionIdResult.left.message;
			yield* logError(
				`Worker failed to create session for "${task.title}": ${error}`,
			);
			return {
				taskId: task.id,
				success: false,
				result: { summary: "", filesModified: [], error },
				tokens: { input: 0, output: 0 },
				cost: 0,
			};
		}

		const sessionId = sessionIdResult.right;

		try {
			yield* logWorker(sessionId, `Starting: ${task.title}`);
			const prompt = workerPrompt(task);

			const responseResult = yield* Effect.either(
				backend.prompt(sessionId, prompt, {
					format: { type: "json_schema", schema: WORKER_SCHEMA },
				}),
			);

			if (Either.isLeft(responseResult)) {
				const error = responseResult.left.message;
				yield* logError(`Worker failed for "${task.title}": ${error}`);
				return {
					taskId: task.id,
					success: false,
					result: { summary: "", filesModified: [], error },
					tokens: { input: 0, output: 0 },
					cost: 0,
				};
			}

			const response = responseResult.right;
			const result = parseWorkerOutput(response.text, task.filePaths);
			yield* logWorker(
				sessionId,
				`Done: ${task.title} — ${result.filesModified.length} files`,
			);

			return {
				taskId: task.id,
				success: true,
				result,
				tokens: response.tokens,
				cost: response.cost,
			};
		} finally {
			yield* backend.destroySession(sessionId);
		}
	});
}

function parseWorkerOutput(text: string, fallbackFiles: string[]): TaskResult {
	try {
		const parsed = JSON.parse(text);
		if (
			parsed &&
			typeof parsed === "object" &&
			Array.isArray(parsed.filesModified) &&
			typeof parsed.summary === "string"
		) {
			return {
				summary: parsed.summary,
				filesModified: parsed.filesModified,
			};
		}
	} catch {
		// Fall back to parsing summary block if JSON parsing fails
	}

	// Fallback: try to extract from summary code block
	const summaryMatch = text.match(/```summary\n([\s\S]*?)```/);
	if (!summaryMatch?.[1]) {
		return {
			summary: text.slice(-500),
			filesModified: fallbackFiles,
		};
	}

	const block = summaryMatch[1];
	const filesLine = block.match(/Files modified:\s*(.+)/i);
	const summaryLine = block.match(/Summary:\s*(.+)/is);

	const filesModified = filesLine?.[1]
		? filesLine[1]
				.split(",")
				.map((f) => f.trim())
				.filter(Boolean)
		: fallbackFiles;

	return {
		summary: summaryLine?.[1]?.trim() ?? "",
		filesModified,
	};
}
