import { withDashboardDb } from "../db.js";
import { serializeTaskDetail } from "../serializers.js";
import type { TaskDetailDto } from "../types.js";

interface TaskQueryRow {
	id: number;
	swarm_id: number;
	title: string;
	description: string;
	status: TaskDetailDto["status"];
	file_paths: string;
	claimed_by: string | null;
	result_summary: string | null;
	files_modified: string | null;
	error: string | null;
	iteration: number;
	judge_feedback: string | null;
	created_at: string;
	updated_at: string;
	dependencies: string | null;
}

export function listTasksBySwarmId(swarmId: number): TaskDetailDto[] {
	return withDashboardDb((sqlite) => {
		const rows = sqlite
			.prepare(
				`SELECT
					t.id,
					t.swarm_id,
					t.title,
					t.description,
					t.status,
					t.file_paths,
					t.claimed_by,
					t.result_summary,
					t.files_modified,
					t.error,
					t.iteration,
					t.judge_feedback,
					t.created_at,
					t.updated_at,
					GROUP_CONCAT(d.depends_on) as dependencies
				FROM tasks t
				LEFT JOIN task_deps d ON d.task_id = t.id
				WHERE t.swarm_id = ?
				GROUP BY t.id
				ORDER BY t.id`,
			)
			.all(swarmId) as TaskQueryRow[];

		return rows.map(serializeTaskDetail);
	}, []);
}

export function getTaskDetail(
	swarmId: number,
	taskId: number,
): TaskDetailDto | null {
	return withDashboardDb((sqlite) => {
		const row = sqlite
			.prepare(
				`SELECT
					t.id,
					t.swarm_id,
					t.title,
					t.description,
					t.status,
					t.file_paths,
					t.claimed_by,
					t.result_summary,
					t.files_modified,
					t.error,
					t.iteration,
					t.judge_feedback,
					t.created_at,
					t.updated_at,
					GROUP_CONCAT(d.depends_on) as dependencies
				FROM tasks t
				LEFT JOIN task_deps d ON d.task_id = t.id
				WHERE t.swarm_id = ? AND t.id = ?
				GROUP BY t.id`,
			)
			.get(swarmId, taskId) as TaskQueryRow | null;

		if (!row) {
			return null;
		}

		return serializeTaskDetail(row);
	}, null);
}
