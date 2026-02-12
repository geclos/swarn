import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../../libs/db.js";
import { tasks } from "../../models/db/tasks.js";

export function markTaskForRetry(
	client: DbClient,
	swarmId: number,
	taskId: number,
	feedback: string,
): void {
	const now = new Date().toISOString();
	client.db
		.update(tasks)
		.set({
			status: "pending",
			claimedBy: null,
			judgeFeedback: feedback,
			iteration: sql`iteration + 1`,
			updatedAt: now,
		})
		.where(and(eq(tasks.swarmId, swarmId), eq(tasks.id, taskId)))
		.run();
}
