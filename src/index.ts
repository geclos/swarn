#!/usr/bin/env bun

import { Effect, Either } from "effect";
import { executePlanner } from "./agents/planner.js";
import { executePublisher } from "./agents/publisher.js";
import { OpenCodeBackend } from "./backend/opencode.js";
import { parseArgs, readPlan } from "./cli.js";
import { initDb } from "./libs/db.js";
import { ValidationError } from "./models/errors.js";

import { orchestrate } from "./orchestrator.js";
import {
	logError,
	loggerLayer,
	logInfo,
	logSuccess,
	withLogLevel,
} from "./output/logger.js";
import { printReport } from "./output/reporter.js";
import { finishSwarm } from "./services/swarms/finish.js";
import { registerSwarm } from "./services/swarms/register.js";
import { initTasks } from "./services/tasks/init-tasks.js";
import { createWorktree, isGitRepo, type WorktreeResult } from "./worktree.js";

const program = Effect.gen(function* () {
	const config = parseArgs(process.argv.slice(2));

	// Set up logging layer with verbosity
	const _logLayer = withLogLevel(config.verbose);

	yield* logInfo("swarn starting...");

	// Read raw plan (freeform markdown/text)
	const rawPlan = yield* readPlan(config).pipe(
		Effect.tapError((error) => logError(error.message)),
		Effect.orDie,
	);
	yield* logInfo("Plan input loaded");

	// Connect to backend
	const backend = new OpenCodeBackend(config.serverUrl);
	const healthy = yield* backend.healthCheck();

	if (!healthy) {
		yield* logError(`Cannot reach OpenCode server at ${config.serverUrl}`);
		yield* logError("Start it with: opencode serve --port 4096");
		return yield* Effect.die(
			new ValidationError({ message: "Backend not available" }),
		);
	}
	yield* logSuccess(`Connected to OpenCode server at ${config.serverUrl}`);

	yield* backend.allowAllPermissions();
	yield* logSuccess("Permissions set to allow");

	// Create git worktree for isolation
	let worktreeResult: WorktreeResult | undefined;
	if (isGitRepo(config.workingDir)) {
		const t0 = Date.now();
		worktreeResult = createWorktree(config.workingDir);
		yield* logInfo(
			`Created worktree in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${worktreeResult.path}`,
		);
		config.workingDir = worktreeResult.path;
	}

	// Run planner agent to convert raw plan → structured tasks
	yield* logInfo(`Using workingDir: ${config.workingDir}`);
	yield* logInfo(
		`Using model: ${config.model ? `${config.model.providerID}/${config.model.modelID}` : "server default"}`,
	);

	const t1 = Date.now();
	const plan = yield* executePlanner(
		backend,
		rawPlan,
		config.workingDir,
		config.model,
	).pipe(
		Effect.tapError((error) => logError(`Planner failed: ${error.message}`)),
		Effect.orDie,
	);
	yield* logInfo(
		`Planner total time: ${((Date.now() - t1) / 1000).toFixed(1)}s`,
	);

	yield* logInfo(`Planner produced ${plan.length} tasks:`);
	for (const task of plan) {
		const deps = task.dependencies?.length
			? ` (depends on: ${task.dependencies.join(", ")})`
			: "";
		yield* logInfo(`  ${task.id}: ${task.title}${deps}`);
	}

	// Initialize db and register swarm
	const dbClient = initDb();
	const swarmId = registerSwarm(dbClient, plan, config, worktreeResult?.branch);
	initTasks(dbClient, swarmId, plan);
	yield* logInfo(`Swarm registered: #${swarmId}`);

	// Run orchestration
	const stats = yield* orchestrate(backend, config, dbClient, swarmId).pipe(
		Effect.tapError((error) => {
			finishSwarm(dbClient, swarmId, "failed", error.message);
			return logError(`Orchestration failed: ${error.message}`);
		}),
		Effect.orDie,
	);

	finishSwarm(dbClient, swarmId, "completed");

	// Publish results to remote if we have a branch
	if (worktreeResult?.branch) {
		yield* logInfo("Publishing results to remote...");

		const publishResult = yield* Effect.either(
			executePublisher(
				backend,
				{
					workingDir: config.workingDir,
				},
				config.model,
			),
		);

		if (Either.isRight(publishResult)) {
			yield* logSuccess(`Results published: ${publishResult.right.prUrl}`);
		} else {
			const error = publishResult.left;
			if (error._tag === "PublishError") {
				yield* logError(`Publish failed: ${error.message}`);
			} else {
				yield* logError(`Publish error: ${error}`);
			}
			yield* logError(
				"Results were not published. You may need to push manually.",
			);
		}
	}

	// Print report
	printReport(stats);

	return stats.tasksFailed > 0 ? 1 : 0;
});

// Run the program with the custom logger
const main = program.pipe(
	Effect.provide(loggerLayer),
	Effect.catchAllDefect((defect) => {
		globalThis.console.error("Fatal error:", defect);
		return Effect.succeed(1);
	}),
);

Effect.runPromise(main)
	.then((exitCode) => {
		process.exit(exitCode);
	})
	.catch((err) => {
		globalThis.console.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	});
