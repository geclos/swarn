import { eq, sql } from "drizzle-orm";
import type { DbClient } from "../../libs/db.js";
import { swarms } from "../../models/db/swarms.js";
import type { SwarmStatus } from "../../models/swarn.js";

export function finishSwarm(
	client: DbClient,
	id: number,
	status: SwarmStatus,
	error?: string,
): void {
	const now = new Date().toISOString();
	client.db
		.update(swarms)
		.set({
			status,
			error: error ?? null,
			updatedAt: now,
			tasksCompleted: sql`(SELECT COUNT(*) FROM tasks WHERE swarm_id = ${id} AND status = 'completed')`,
			tasksFailed: sql`(SELECT COUNT(*) FROM tasks WHERE swarm_id = ${id} AND status = 'failed')`,
		})
		.where(eq(swarms.id, id))
		.run();
}
