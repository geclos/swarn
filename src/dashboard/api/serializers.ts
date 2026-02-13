import type {
	ProgressRatios,
	StatusCounts,
	SwarmDetailDto,
	SwarmListItemDto,
	TaskDetailDto,
} from "./types.js";

interface SwarmRowWithCounts {
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

interface TaskRowWithDeps {
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

export function serializeStatusCounts(row: {
	total: number | null;
	pending: number | null;
	in_progress: number | null;
	completed: number | null;
	failed: number | null;
	blocked: number | null;
}): StatusCounts {
	return {
		total: numberOrZero(row.total),
		pending: numberOrZero(row.pending),
		inProgress: numberOrZero(row.in_progress),
		completed: numberOrZero(row.completed),
		failed: numberOrZero(row.failed),
		blocked: numberOrZero(row.blocked),
	};
}

export function serializeProgress(counts: StatusCounts): ProgressRatios {
	if (counts.total === 0) {
		return { completed: 0, failed: 0, resolved: 0 };
	}

	const completed = counts.completed / counts.total;
	const failed = counts.failed / counts.total;

	return {
		completed,
		failed,
		resolved: completed + failed,
	};
}

export function serializeSwarmListItem(
	row: SwarmRowWithCounts,
): SwarmListItemDto {
	const statusCounts = serializeStatusCounts(row);

	return {
		id: row.id,
		status: row.status,
		workingDir: row.working_dir,
		branch: row.branch,
		iteration: row.iteration,
		maxIterations: row.max_iterations,
		tasksTotal: row.tasks_total,
		tasksCompleted: row.tasks_completed,
		tasksFailed: row.tasks_failed,
		tokensIn: row.tokens_in,
		tokensOut: row.tokens_out,
		cost: row.cost,
		error: row.error,
		pid: row.pid,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		statusCounts,
		progress: serializeProgress(statusCounts),
	};
}

export function serializeSwarmDetail(row: SwarmRowWithCounts): SwarmDetailDto {
	return {
		...serializeSwarmListItem(row),
		plan: parseJson(row.plan, null),
		config: parseJson(row.config, null),
	};
}

export function serializeTaskDetail(row: TaskRowWithDeps): TaskDetailDto {
	return {
		id: row.id,
		swarmId: row.swarm_id,
		title: row.title,
		description: row.description,
		status: row.status,
		filePaths: parseJsonArray(row.file_paths),
		dependencies: parseDependencyIds(row.dependencies),
		claimedBy: row.claimed_by,
		resultSummary: row.result_summary,
		filesModified: parseJsonArray(row.files_modified),
		error: row.error,
		iteration: row.iteration,
		judgeFeedback: row.judge_feedback,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function parseJson<T>(value: string | null, fallback: T): T {
	if (value === null) {
		return fallback;
	}

	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

function parseJsonArray(value: string | null): string[] {
	const parsed = parseJson<unknown>(value, []);
	if (!Array.isArray(parsed)) {
		return [];
	}

	return parsed.filter((item): item is string => typeof item === "string");
}

function parseDependencyIds(value: string | null): number[] {
	if (!value) {
		return [];
	}

	const ids: number[] = [];
	for (const dep of value.split(",")) {
		const parsed = Number.parseInt(dep, 10);
		if (!Number.isNaN(parsed)) {
			ids.push(parsed);
		}
	}

	return ids;
}

function numberOrZero(value: number | null): number {
	if (value === null) {
		return 0;
	}

	return value;
}
