import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../libs/db.js";
import { tasks } from "../../models/db/tasks.js";

export function failTask(
	client: DbClient,
	swarmId: number,
	taskId: number,
	error: string,
): void {
	const now = new Date().toISOString();
	client.db
		.update(tasks)
		.set({
			status: "failed",
			error,
			resultSummary: "",
			filesModified: "[]",
			updatedAt: now,
		})
		.where(and(eq(tasks.swarmId, swarmId), eq(tasks.id, taskId)))
		.run();
}
