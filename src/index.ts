#!/usr/bin/env bun

import {
	Effect,
	Logger as EffectLogger,
	Either,
	Layer,
	LogLevel,
} from "effect";
import { executePlanner } from "./agents/planner.js";
import { OpenCodeBackend } from "./backend/opencode.js";
import { parseArgs, readPlan } from "./cli.js";
import { initDb } from "./libs/db.js";
import { ValidationError } from "./models/errors.js";
import type { PlanTask } from "./models/swarn.js";
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
import { createWorktree, isGitRepo } from "./worktree.js";

const program = Effect.gen(function* () {
	const config = parseArgs(process.argv.slice(2));

	// Set up logging layer with verbosity
	const logLayer = withLogLevel(config.verbose);

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
	let worktreeDir: string | undefined;
	if (isGitRepo(config.workingDir)) {
		const t0 = Date.now();
		worktreeDir = createWorktree(config.workingDir);
		yield* logInfo(
			`Created worktree in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${worktreeDir}`,
		);
		config.workingDir = worktreeDir;
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
	const swarmId = registerSwarm(dbClient, plan, config);
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
