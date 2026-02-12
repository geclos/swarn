import type { DbClient } from "../../libs/db.js";
import { taskDeps } from "../../models/db/task-deps.js";
import { tasks } from "../../models/db/tasks.js";
import type { PlanTask } from "../../models/swarn.js";

export function initTasks(
	client: DbClient,
	swarmId: number,
	plan: PlanTask[],
): void {
	const now = new Date().toISOString();
	const planIdToDbId = new Map<string, number>();

	const tx = client.sqlite.transaction(() => {
		for (const task of plan) {
			const hasDeps = task.dependencies && task.dependencies.length > 0;
			const status = hasDeps ? "blocked" : "pending";

			const result = client.db
				.insert(tasks)
				.values({
					swarmId,
					title: task.title,
					description: task.description,
					status,
					filePaths: JSON.stringify(task.filePaths ?? []),
					iteration: 0,
					createdAt: now,
					updatedAt: now,
				})
				.returning({ id: tasks.id })
				.get();

			planIdToDbId.set(task.id, result.id);
		}

		for (const task of plan) {
			if (!task.dependencies?.length) continue;
			const taskDbId = planIdToDbId.get(task.id);
			if (!taskDbId) continue;
			for (const depPlanId of task.dependencies) {
				const depDbId = planIdToDbId.get(depPlanId);
				if (depDbId !== undefined) {
					client.db
						.insert(taskDeps)
						.values({ taskId: taskDbId, dependsOn: depDbId })
						.run();
				}
			}
		}
	});

	tx();
}
