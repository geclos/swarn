import { Effect } from "effect";
import type { AgentBackend } from "../backend/interface.js";
import type { PromptError, SessionError } from "../models/errors.js";
import type { JudgeVerdict } from "../models/swarn.js";
import type { Task } from "../models/task.js";
import { logJudge } from "../output/logger.js";

const JUDGE_SCHEMA = {
	type: "object",
	properties: {
		verdict: {
			type: "string",
			enum: ["done", "iterate", "fail"],
			description:
				"Whether the implementation is complete ('done'), needs more work ('iterate'), or has critical failures ('fail')",
		},
		score: {
			type: "number",
			minimum: 0,
			maximum: 100,
			description: "Quality score from 0-100",
		},
		feedback: {
			type: "string",
			description: "Overall assessment of the implementation",
		},
		failedTasks: {
			type: "array",
			items: {
				type: "object",
				properties: {
					taskId: {
						type: "number",
						description: "The ID of the task that failed or needs revision",
					},
					reason: {
						type: "string",
						description: "Explanation of what's wrong with the task",
					},
					suggestion: {
						type: "string",
						description: "Specific fix needed for the task",
					},
				},
				required: ["taskId", "reason", "suggestion"],
			},
			description:
				"Array of tasks that need revision (empty if verdict is 'done')",
		},
	},
	required: ["verdict", "score", "feedback", "failedTasks"],
};

function judgePrompt(
	plan: Task[],
	completedTasks: Task[],
	failedTasks: Task[],
): string {
	const planOverview = plan
		.map((t) => `- [#${t.id}] ${t.title}: ${t.description.slice(0, 120)}...`)
		.join("\n");

	const completedSummary = completedTasks
		.map((t) => {
			const result = t.result
				? `Summary: ${t.result.summary}\nFiles: ${t.result.filesModified.join(", ")}`
				: "No result recorded";
			return `- [#${t.id}] ${t.title}\n  ${result}`;
		})
		.join("\n");

	const failedSummary = failedTasks
		.map((t) => {
			const err = t.result?.error ?? "Unknown error";
			return `- [#${t.id}] ${t.title}\n  Error: ${err}`;
		})
		.join("\n");

	return `You are a senior engineer reviewing implementation against a plan. Each task had specific requirements — check if they were met. Check: completeness, correctness, code quality, no regressions. Be pragmatic — 80% correct beats another iteration that might regress. If iterating: provide specific, actionable feedback per failed task.

## Original Plan
${planOverview}

## Completed Tasks
${completedSummary || "None"}

## Failed Tasks
${failedSummary || "None"}

## Instructions
1. Review the code changes by examining the files listed in each completed task
2. Check that each task's requirements from the plan were met
3. Output your verdict as a JSON object with your assessment`;
}

export type JudgeError = SessionError | PromptError;

export interface JudgeResult {
	verdict: JudgeVerdict;
	tokens: { input: number; output: number };
	cost: number;
}

export function executeJudge(
	backend: AgentBackend,
	allTasks: Task[],
	workingDir: string,
	model?: { providerID: string; modelID: string } | null,
): Effect.Effect<JudgeResult, JudgeError> {
	return Effect.gen(function* () {
		const completedTasks = allTasks.filter((t) => t.status === "completed");
		const failedTasks = allTasks.filter((t) => t.status === "failed");

		const sessionId = yield* backend.createSession({
			title: "swarn-judge",
			mode: "build",
			workingDir,
			model: model ?? undefined,
		});

		try {
			yield* logJudge("Reviewing task results...");
			const prompt = judgePrompt(allTasks, completedTasks, failedTasks);
			const response = yield* backend.prompt(sessionId, prompt, {
				format: { type: "json_schema", schema: JUDGE_SCHEMA },
			});

			const verdict = parseVerdict(response.text, response.structuredOutput);
			yield* logJudge(`Verdict: ${verdict.verdict} (score: ${verdict.score})`);

			if (verdict.failedTasks.length > 0) {
				yield* logJudge(`${verdict.failedTasks.length} tasks need revision`);
			}

			if (verdict.verdict === "fail") {
				yield* logJudge(`Critical failure detected: ${verdict.feedback}`);
			}

			return {
				verdict,
				tokens: response.tokens,
				cost: response.cost,
			};
		} finally {
			yield* backend.destroySession(sessionId);
		}
	});
}

function parseVerdict(text: string, structuredOutput?: unknown): JudgeVerdict {
	const coerceScore = (
		score: unknown,
		verdict: "done" | "iterate" | "fail",
	): number => {
		if (typeof score === "number" && !Number.isNaN(score)) {
			return Math.max(0, Math.min(100, score));
		}
		if (typeof score === "string" && score.trim() !== "") {
			const parsed = Number(score);
			if (!Number.isNaN(parsed)) {
				return Math.max(0, Math.min(100, parsed));
			}
		}
		return verdict === "done" ? 80 : verdict === "fail" ? 10 : 40;
	};

	const coerceVerdict = (value: unknown): "done" | "iterate" | "fail" => {
		if (value === "done" || value === "iterate" || value === "fail") {
			return value;
		}
		return "iterate";
	};

	const fromStructured = (value: unknown): JudgeVerdict | null => {
		if (!value || typeof value !== "object") return null;
		const record = value as Record<string, unknown>;
		const verdict = coerceVerdict(record.verdict);
		const failedTasks = Array.isArray(record.failedTasks)
			? (record.failedTasks as JudgeVerdict["failedTasks"])
			: [];
		const feedback =
			typeof record.feedback === "string" ? record.feedback : text.slice(-500);
		return {
			verdict,
			score: coerceScore(record.score, verdict),
			feedback,
			failedTasks,
		};
	};

	const structuredVerdict = fromStructured(structuredOutput);
	if (structuredVerdict) {
		return structuredVerdict;
	}

	try {
		const parsed = JSON.parse(text) as Partial<JudgeVerdict>;
		const verdict = coerceVerdict(parsed.verdict);
		// Ensure all required fields are present with defaults
		return {
			verdict,
			score: coerceScore(parsed.score, verdict),
			feedback: parsed.feedback ?? text.slice(-500),
			failedTasks: parsed.failedTasks ?? [],
		};
	} catch {
		// Best-effort extraction if JSON parsing fails
		const isDone =
			/verdict.*done/i.test(text) || /all tasks.*complet/i.test(text);
		const verdict = isDone ? "done" : "iterate";
		return {
			verdict,
			score: coerceScore(undefined, verdict),
			feedback: text.slice(-500),
			failedTasks: [],
		};
	}
}
