import { eq, sql } from "drizzle-orm";
import type { DbClient } from "../../libs/db.js";
import { swarms } from "../../models/db/swarms.js";
import type { ProgressStats } from "../../models/swarn.js";

export function updateSwarmProgress(
	client: DbClient,
	id: number,
	stats: ProgressStats,
): void {
	const now = new Date().toISOString();
	const sets: Record<string, unknown> = { updatedAt: now };

	if (stats.iteration !== undefined) sets.iteration = stats.iteration;
	if (stats.tokensIn !== undefined) sets.tokensIn = stats.tokensIn;
	if (stats.tokensOut !== undefined) sets.tokensOut = stats.tokensOut;
	if (stats.cost !== undefined) sets.cost = stats.cost;

	client.db
		.update(swarms)
		.set({
			...sets,
			tasksCompleted: sql`(SELECT COUNT(*) FROM tasks WHERE swarm_id = ${id} AND status = 'completed')`,
			tasksFailed: sql`(SELECT COUNT(*) FROM tasks WHERE swarm_id = ${id} AND status = 'failed')`,
		})
		.where(eq(swarms.id, id))
		.run();
}
