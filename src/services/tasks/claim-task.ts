import type { DbClient } from "../../libs/db.js";
import type { Task } from "../../models/task.js";
import { getTaskById } from "../../repositories/tasks.js";

export function claimTask(
	client: DbClient,
	swarmId: number,
	taskId: number,
	sessionId: string,
): Task | null {
	const now = new Date().toISOString();
	const changes = client.sqlite.run(
		`UPDATE tasks SET status = 'in_progress', claimed_by = ?, updated_at = ?
     WHERE swarm_id = ? AND id = ? AND status = 'pending'`,
		[sessionId, now, swarmId, taskId],
	);

	if (changes.changes === 0) return null;
	return getTaskById(client, swarmId, taskId);
}
