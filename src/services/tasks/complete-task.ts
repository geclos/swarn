import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../libs/db.js";
import { tasks } from "../../models/db/tasks.js";
import type { TaskResult } from "../../models/task.js";
import { unblockDependents } from "./unblock-dependents.js";

export function completeTask(
	client: DbClient,
	swarmId: number,
	taskId: number,
	result: TaskResult,
): void {
	const now = new Date().toISOString();

	const tx = client.sqlite.transaction(() => {
		client.db
			.update(tasks)
			.set({
				status: "completed",
				resultSummary: result.summary,
				filesModified: JSON.stringify(result.filesModified),
				error: null,
				updatedAt: now,
			})
			.where(and(eq(tasks.swarmId, swarmId), eq(tasks.id, taskId)))
			.run();

		unblockDependents(client, swarmId);
	});

	tx();
}
