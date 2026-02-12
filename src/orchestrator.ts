import { Effect } from "effect";
import { executeJudge, type JudgeError } from "./agents/judge.js";
import { executeWorker } from "./agents/worker.js";
import type { AgentBackend } from "./backend/interface.js";
import type { DbClient } from "./libs/db.js";
import type { RunStats, SwarnConfig } from "./models/swarn.js";
import { logInfo, logIteration } from "./output/logger.js";
import {
	getClaimableTasks,
	getFilesChanged,
	getTaskSummary,
	getTasks,
} from "./repositories/tasks.js";
import { updateSwarmProgress } from "./services/swarms/update-progress.js";
import { claimTask } from "./services/tasks/claim-task.js";
import { completeTask } from "./services/tasks/complete-task.js";
import { failTask } from "./services/tasks/fail-task.js";
import { markTaskForRetry } from "./services/tasks/mark-for-retry.js";

export function orchestrate(
	backend: AgentBackend,
	config: SwarnConfig,
	client: DbClient,
	swarmId: number,
): Effect.Effect<RunStats, JudgeError> {
	return Effect.gen(function* () {
		const startTime = Date.now();
		const stats: RunStats = {
			iterations: 0,
			tasksCompleted: 0,
			tasksFailed: 0,
			totalTokens: { input: 0, output: 0 },
			totalCost: 0,
			filesChanged: [],
			duration: 0,
			worktreePath: config.workingDir,
		};

		for (let iteration = 1; iteration <= config.maxIterations; iteration++) {
			stats.iterations = iteration;
			yield* logIteration(iteration, config.maxIterations);

			// Work phase: run all claimable tasks in parallel
			yield* workPhase(backend, client, swarmId, config, stats);

			updateSwarmProgress(client, swarmId, {
				iteration,
				tokensIn: stats.totalTokens.input,
				tokensOut: stats.totalTokens.output,
				cost: stats.totalCost,
			});

			const summary = getTaskSummary(client, swarmId);
			yield* logInfo(
				`Tasks: ${summary.completed} done, ${summary.failed} failed, ${summary.pending + summary.blocked} remaining`,
			);

			// If no tasks left to process, check with judge
			if (
				summary.pending === 0 &&
				summary.inProgress === 0 &&
				summary.blocked === 0
			) {
				// Judge phase
				const tasks = getTasks(client, swarmId);
				if (tasks.every((t) => t.status === "completed")) {
					// All done — still run judge for validation
					const judgeResult = yield* executeJudge(
						backend,
						tasks,
						config.workingDir,
						config.model,
					);
					stats.totalTokens.input += judgeResult.tokens.input;
					stats.totalTokens.output += judgeResult.tokens.output;
					stats.totalCost += judgeResult.cost;

					if (
						judgeResult.verdict.verdict === "done" ||
						iteration === config.maxIterations
					) {
						break;
					}

					// Judge wants iteration: mark failed tasks for retry
					for (const ft of judgeResult.verdict.failedTasks) {
						markTaskForRetry(client, swarmId, ft.taskId, ft.suggestion);
					}
					continue;
				}

				// Some tasks failed and none are pending — run judge
				const judgeResult = yield* executeJudge(
					backend,
					tasks,
					config.workingDir,
					config.model,
				);
				stats.totalTokens.input += judgeResult.tokens.input;
				stats.totalTokens.output += judgeResult.tokens.output;
				stats.totalCost += judgeResult.cost;

				if (
					judgeResult.verdict.verdict === "done" ||
					iteration === config.maxIterations
				) {
					break;
				}

				// Mark failed tasks for retry with judge feedback
				for (const ft of judgeResult.verdict.failedTasks) {
					markTaskForRetry(client, swarmId, ft.taskId, ft.suggestion);
				}

				// Also retry any tasks that failed without specific judge feedback
				const failedWithoutFeedback = tasks.filter(
					(t) =>
						t.status === "failed" &&
						!judgeResult.verdict.failedTasks.some((ft) => ft.taskId === t.id),
				);
				for (const t of failedWithoutFeedback) {
					markTaskForRetry(client, swarmId, t.id, judgeResult.verdict.feedback);
				}
			}

			updateSwarmProgress(client, swarmId, {
				iteration,
				tokensIn: stats.totalTokens.input,
				tokensOut: stats.totalTokens.output,
				cost: stats.totalCost,
			});
		}

		// Final stats
		const finalSummary = getTaskSummary(client, swarmId);
		stats.tasksCompleted = finalSummary.completed;
		stats.tasksFailed = finalSummary.failed;
		stats.filesChanged = getFilesChanged(client, swarmId);
		stats.duration = Date.now() - startTime;

		return stats;
	});
}

function workPhase(
	backend: AgentBackend,
	client: DbClient,
	swarmId: number,
	config: SwarnConfig,
	stats: RunStats,
): Effect.Effect<void, never> {
	return Effect.gen(function* () {
		while (true) {
			const claimable = getClaimableTasks(client, swarmId);
			if (claimable.length === 0) break;

			// Process in batches of maxWorkers
			const batch = claimable.slice(0, config.maxWorkers);
			yield* logInfo(`Dispatching ${batch.length} workers...`);

			const promises = batch.map((task) =>
				Effect.gen(function* () {
					const claimed = claimTask(client, swarmId, task.id, "pending");
					if (!claimed) return;

					const result = yield* executeWorker(
						backend,
						claimed,
						config.workingDir,
						config.model,
					);

					if (result.success) {
						completeTask(client, swarmId, task.id, result.result);
					} else {
						failTask(
							client,
							swarmId,
							task.id,
							result.result.error ?? "Unknown error",
						);
					}

					stats.totalTokens.input += result.tokens.input;
					stats.totalTokens.output += result.tokens.output;
					stats.totalCost += result.cost;
				}),
			);

			yield* Effect.all(promises);
		}
	});
}
