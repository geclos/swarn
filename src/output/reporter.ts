import type { RunStats } from "../models/swarn.js";

export function printReport(stats: RunStats): void {
	const duration = (stats.duration / 1000).toFixed(1);
	const cost = stats.totalCost.toFixed(4);

	console.log("\n\x1b[1m=== Swarn Run Complete ===\x1b[0m\n");
	console.log(`  Iterations:    ${stats.iterations}`);
	console.log(
		`  Tasks:         \x1b[32m${stats.tasksCompleted} completed\x1b[0m, \x1b[31m${stats.tasksFailed} failed\x1b[0m`,
	);
	console.log(`  Files changed: ${stats.filesChanged.length}`);

	if (stats.filesChanged.length > 0) {
		for (const f of stats.filesChanged) {
			console.log(`    - ${f}`);
		}
	}

	console.log(
		`  Tokens:        ${stats.totalTokens.input} in / ${stats.totalTokens.output} out`,
	);
	console.log(`  Cost:          $${cost}`);
	console.log(`  Duration:      ${duration}s`);

	if (stats.worktreePath) {
		console.log(`\n  Worktree:      ${stats.worktreePath}`);
	}

	console.log();
}
