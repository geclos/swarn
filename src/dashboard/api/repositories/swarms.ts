import { withDashboardDb } from "../db.js";
import {
	serializeStatusCounts,
	serializeSwarmDetail,
	serializeSwarmListItem,
} from "../serializers.js";
import type {
	StatusCounts,
	SwarmDetailDto,
	SwarmListItemDto,
} from "../types.js";

interface SwarmQueryRow {
	id: number;
	status: SwarmListItemDto["status"];
	working_dir: string;
	branch: string | null;
	plan: string;
	config: string;
	iteration: number;
	max_iterations: number;
	tasks_total: number;
	tasks_completed: number;
	tasks_failed: number;
	tokens_in: number;
	tokens_out: number;
	cost: number;
	error: string | null;
	pid: number;
	created_at: string;
	updated_at: string;
	total: number | null;
	pending: number | null;
	in_progress: number | null;
	completed: number | null;
	failed: number | null;
	blocked: number | null;
}

export function listSwarms(limit = 100): SwarmListItemDto[] {
	return withDashboardDb((sqlite) => {
		const rows = sqlite
			.prepare(
				`SELECT
					s.id,
					s.status,
					s.working_dir,
					s.branch,
					s.plan,
					s.config,
					s.iteration,
					s.max_iterations,
					s.tasks_total,
					s.tasks_completed,
					s.tasks_failed,
					s.tokens_in,
					s.tokens_out,
					s.cost,
					s.error,
					s.pid,
					s.created_at,
					s.updated_at,
					COUNT(t.id) as total,
					SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending,
					SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
					SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
					SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed,
					SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) as blocked
				FROM swarms s
				LEFT JOIN tasks t ON t.swarm_id = s.id
				GROUP BY s.id
				ORDER BY s.created_at DESC
				LIMIT ?`,
			)
			.all(limit) as SwarmQueryRow[];

		return rows.map(serializeSwarmListItem);
	}, []);
}

export function getSwarmDetail(swarmId: number): SwarmDetailDto | null {
	return withDashboardDb((sqlite) => {
		const row = sqlite
			.prepare(
				`SELECT
					s.id,
					s.status,
					s.working_dir,
					s.branch,
					s.plan,
					s.config,
					s.iteration,
					s.max_iterations,
					s.tasks_total,
					s.tasks_completed,
					s.tasks_failed,
					s.tokens_in,
					s.tokens_out,
					s.cost,
					s.error,
					s.pid,
					s.created_at,
					s.updated_at,
					COUNT(t.id) as total,
					SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending,
					SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
					SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
					SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed,
					SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) as blocked
				FROM swarms s
				LEFT JOIN tasks t ON t.swarm_id = s.id
				WHERE s.id = ?
				GROUP BY s.id`,
			)
			.get(swarmId) as SwarmQueryRow | null;

		if (!row) {
			return null;
		}

		return serializeSwarmDetail(row);
	}, null);
}

export function getSwarmStatusCounts(swarmId: number): StatusCounts {
	return withDashboardDb(
		(sqlite) => {
			const row = sqlite
				.prepare(
					`SELECT
					COUNT(*) as total,
					SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
					SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
					SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
					SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
					SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
				FROM tasks
				WHERE swarm_id = ?`,
				)
				.get(swarmId) as {
				total: number | null;
				pending: number | null;
				in_progress: number | null;
				completed: number | null;
				failed: number | null;
				blocked: number | null;
			};

			return serializeStatusCounts(row);
		},
		{
			total: 0,
			pending: 0,
			inProgress: 0,
			completed: 0,
			failed: 0,
			blocked: 0,
		},
	);
}
