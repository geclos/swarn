import { Effect } from "effect";
import type { AgentBackend } from "../backend/interface.js";
import type { PromptError, SessionError } from "../models/errors.js";
import type { JudgeVerdict } from "../models/swarn.js";
import type { Task } from "../models/task.js";
import { logJudge } from "../output/logger.js";

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
3. Output your verdict as a JSON block:

\`\`\`json
{
  "verdict": "done" | "iterate",
  "score": <0-100>,
  "feedback": "<overall assessment>",
  "failedTasks": [
    {
      "taskId": <number>,
      "reason": "<what's wrong>",
      "suggestion": "<specific fix>"
    }
  ]
}
\`\`\``;
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
			const response = yield* backend.prompt(sessionId, prompt);

			const verdict = parseVerdict(response.text);
			yield* logJudge(`Verdict: ${verdict.verdict} (score: ${verdict.score})`);

			if (verdict.verdict === "iterate" && verdict.failedTasks.length > 0) {
				yield* logJudge(`${verdict.failedTasks.length} tasks need revision`);
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

function parseVerdict(text: string): JudgeVerdict {
	const jsonMatch = text.match(/```json\n([\s\S]*?)```/);
	if (jsonMatch?.[1]) {
		try {
			return JSON.parse(jsonMatch[1]) as JudgeVerdict;
		} catch {
			// fall through to defaults
		}
	}

	// Try parsing the entire text as JSON
	try {
		return JSON.parse(text) as JudgeVerdict;
	} catch {
		// fall through
	}

	// Best-effort extraction
	const isDone =
		/verdict.*done/i.test(text) || /all tasks.*complet/i.test(text);
	return {
		verdict: isDone ? "done" : "iterate",
		score: isDone ? 80 : 40,
		feedback: text.slice(-500),
		failedTasks: [],
	};
}
