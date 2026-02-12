import type { DbClient } from "../../libs/db.js";

export function unblockDependents(client: DbClient, swarmId: number): void {
	const now = new Date().toISOString();
	client.sqlite.run(
		`UPDATE tasks SET status = 'pending', updated_at = ?
     WHERE swarm_id = ? AND status = 'blocked'
     AND NOT EXISTS (
       SELECT 1 FROM task_deps d
       JOIN tasks dep ON dep.id = d.depends_on
       WHERE d.task_id = tasks.id AND dep.status != 'completed'
     )`,
		[now, swarmId],
	);
}
