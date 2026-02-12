import type { DbClient } from "../../libs/db.js";
import { swarms } from "../../models/db/swarms.js";
import type { PlanTask, SwarnConfig } from "../../models/swarn.js";

export function registerSwarm(
	client: DbClient,
	plan: PlanTask[],
	config: SwarnConfig,
): number {
	const now = new Date().toISOString();
	const result = client.db
		.insert(swarms)
		.values({
			status: "running",
			workingDir: config.workingDir,
			plan: JSON.stringify(plan),
			config: JSON.stringify(config),
			maxIterations: config.maxIterations,
			tasksTotal: plan.length,
			pid: process.pid,
			createdAt: now,
			updatedAt: now,
		})
		.returning({ id: swarms.id })
		.get();
	return result.id;
}
