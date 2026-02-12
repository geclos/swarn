import { Effect } from "effect";
import type { AgentBackend } from "../backend/interface.js";
import { PromptError, type SessionError } from "../models/errors.js";
import type { PlanTask } from "../models/swarn.js";
import { logDebug, logInfo } from "../output/logger.js";

const PLANNER_SCHEMA = {
	type: "array",
	items: {
		type: "object",
		properties: {
			id: {
				type: "string",
				description: "Sequential ID in T-XX format (T-01, T-02, ...)",
			},
			title: {
				type: "string",
				description: "Short, descriptive title for the task",
			},
			description: {
				type: "string",
				description:
					"Detailed, implementation-ready description. Tell the engineer exactly what to do: which files to create/modify, what functions to write, what patterns to follow, what edge cases to handle. Reference specific files and existing code.",
			},
			filePaths: {
				type: "array",
				items: { type: "string" },
				description: "Array of file paths that will be created or modified",
			},
			dependencies: {
				type: "array",
				items: { type: "string" },
				description:
					"Array of T-XX IDs that must complete before this task can start. Empty array if no dependencies.",
			},
		},
		required: ["id", "title", "description"],
	},
};

function plannerPrompt(rawPlan: string): string {
	return `You are a senior software architect. You receive a high-level user request and must produce a detailed, actionable execution plan.

## Your Process

1. **Read the user's request** carefully
2. **Explore the codebase** thoroughly — list files, read key files, understand existing patterns, architecture, and conventions
3. **Break the work into concrete tasks** — each task should be independently executable by a focused engineer
4. **Write detailed descriptions** — not just titles, but implementation-ready instructions referencing specific files, existing patterns, and concrete requirements
5. **Declare dependencies** between tasks using T-XX IDs
6. **Output the result** as a JSON array

## User Request

${rawPlan}

## Output Format

Output a JSON array of tasks. Each task must have:

- \`id\`: Sequential ID in "T-XX" format (T-01, T-02, ...)
- \`title\`: Short, descriptive title
- \`description\`: Detailed, implementation-ready description. Tell the engineer exactly what to do: which files to create/modify, what functions to write, what patterns to follow, what edge cases to handle. Reference specific files and existing code.
- \`filePaths\`: Array of file paths that will be created or modified
- \`dependencies\`: Array of T-XX IDs that must complete before this task can start. Empty array if no dependencies.

Important:
- Explore the codebase BEFORE planning — understand what exists
- Keep tasks focused — one concern per task
- Descriptions must be detailed enough for an engineer to implement without asking questions
- Dependencies should form a valid DAG (no cycles)`;
}

export type PlannerError = SessionError | PromptError;

export function executePlanner(
	backend: AgentBackend,
	rawPlan: string,
	workingDir: string,
	model?: { providerID: string; modelID: string } | null,
): Effect.Effect<PlanTask[], PlannerError> {
	return Effect.gen(function* () {
		yield* logInfo(
			"Planner agent exploring codebase and generating execution plan...",
		);

		const sessionId = yield* backend.createSession({
			title: "swarn-planner",
			mode: "build",
			workingDir,
			model: model ?? undefined,
		});

		try {
			const prompt = plannerPrompt(rawPlan);
			const t0 = Date.now();
			yield* logDebug(`Planner prompt being sent (${prompt.length} chars)...`);

			const response = yield* backend.prompt(sessionId, prompt, {
				format: { type: "json_schema", schema: PLANNER_SCHEMA },
			});

			yield* logDebug(
				`Planner prompt completed in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
			);

			const tasks = yield* parsePlannerOutput(response.text);
			yield* logInfo(`Planner produced ${tasks.length} tasks`);

			return tasks;
		} finally {
			yield* backend.destroySession(sessionId);
		}
	});
}

function parsePlannerOutput(
	text: string,
): Effect.Effect<PlanTask[], PromptError> {
	return Effect.gen(function* () {
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			return yield* new PromptError({
				message: "Planner did not produce valid JSON output",
			});
		}

		if (!Array.isArray(parsed) || parsed.length === 0) {
			return yield* new PromptError({
				message: "Planner output must include a non-empty JSON array of tasks",
			});
		}

		const tasks = parsed as PlanTask[];
		const ids = new Set<string>();

		for (const task of tasks) {
			if (!task.id || !task.title || !task.description) {
				return yield* new PromptError({
					message: `Planner task missing required fields (id, title, description): ${JSON.stringify(task)}`,
				});
			}
			if (ids.has(task.id)) {
				return yield* new PromptError({
					message: `Duplicate task ID: ${task.id}`,
				});
			}
			ids.add(task.id);
		}

		for (const task of tasks) {
			if (!task.dependencies) continue;
			for (const dep of task.dependencies) {
				if (!ids.has(dep)) {
					return yield* new PromptError({
						message: `Task ${task.id} references unknown dependency: ${dep}`,
					});
				}
			}
		}

		return tasks;
	});
}
