import type { Database } from "bun:sqlite";
import type { DbClient } from "../libs/db.js";
import type { TaskRow } from "../models/db/tasks.js";
import type { BoardSummary, Task } from "../models/task.js";

export function getClaimableTasks(client: DbClient, swarmId: number): Task[] {
	const claimableRows = client.sqlite
		.prepare(
			`SELECT t.* FROM tasks t
       WHERE t.swarm_id = ? AND t.status = 'pending'
       AND NOT EXISTS (
         SELECT 1 FROM task_deps d
         JOIN tasks dep ON dep.id = d.depends_on
         WHERE d.task_id = t.id AND dep.status != 'completed'
       )`,
		)
		.all(swarmId) as TaskRow[];

	return claimableRows.map((r) => mapTaskRow(client.sqlite, r));
}

export function getTasks(client: DbClient, swarmId: number): Task[] {
	const rows = client.sqlite
		.prepare("SELECT * FROM tasks WHERE swarm_id = ? ORDER BY id")
		.all(swarmId) as TaskRow[];
	return rows.map((r) => mapTaskRow(client.sqlite, r));
}

export function getTaskById(
	client: DbClient,
	swarmId: number,
	taskId: number,
): Task | null {
	const row = client.sqlite
		.prepare("SELECT * FROM tasks WHERE swarm_id = ? AND id = ?")
		.get(swarmId, taskId) as TaskRow | undefined;
	if (!row) return null;
	return mapTaskRow(client.sqlite, row);
}

export function getTaskSummary(
	client: DbClient,
	swarmId: number,
): BoardSummary {
	return client.sqlite
		.prepare(
			`SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
      FROM tasks WHERE swarm_id = ?`,
		)
		.get(swarmId) as BoardSummary;
}

export function getFilesChanged(client: DbClient, swarmId: number): string[] {
	const rows = client.sqlite
		.prepare(
			"SELECT files_modified FROM tasks WHERE swarm_id = ? AND status = 'completed' AND files_modified IS NOT NULL",
		)
		.all(swarmId) as { files_modified: string }[];

	const files = new Set<string>();
	for (const r of rows) {
		for (const f of JSON.parse(r.files_modified) as string[]) {
			files.add(f);
		}
	}
	return [...files];
}

function mapTaskRow(sqlite: Database, row: TaskRow): Task {
	const deps = sqlite
		.prepare("SELECT depends_on FROM task_deps WHERE task_id = ?")
		.all(row.id) as { depends_on: number }[];

	return {
		id: row.id,
		title: row.title,
		description: row.description,
		status: row.status as Task["status"],
		filePaths: JSON.parse(row.file_paths),
		dependencies: deps.map((d) => d.depends_on),
		claimedBy: row.claimed_by,
		result:
			row.result_summary !== null
				? {
						summary: row.result_summary,
						filesModified: row.files_modified
							? JSON.parse(row.files_modified)
							: [],
						error: row.error ?? undefined,
					}
				: null,
		iteration: row.iteration,
		judgeFeedback: row.judge_feedback ?? undefined,
	};
}
