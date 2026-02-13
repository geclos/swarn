export type DashboardSwarmStatus =
	| "running"
	| "completed"
	| "failed"
	| "stopped";

export type DashboardTaskStatus =
	| "pending"
	| "in_progress"
	| "completed"
	| "failed"
	| "blocked";

export interface StatusCounts {
	total: number;
	pending: number;
	inProgress: number;
	completed: number;
	failed: number;
	blocked: number;
}

export interface ProgressRatios {
	completed: number;
	failed: number;
	resolved: number;
}

export interface SwarmListItemDto {
	id: number;
	status: DashboardSwarmStatus;
	workingDir: string;
	branch: string | null;
	iteration: number;
	maxIterations: number;
	tasksTotal: number;
	tasksCompleted: number;
	tasksFailed: number;
	tokensIn: number;
	tokensOut: number;
	cost: number;
	error: string | null;
	pid: number;
	createdAt: string;
	updatedAt: string;
	statusCounts: StatusCounts;
	progress: ProgressRatios;
}

export interface SwarmDetailDto extends SwarmListItemDto {
	plan: unknown;
	config: unknown;
}

export interface TaskDetailDto {
	id: number;
	swarmId: number;
	title: string;
	description: string;
	status: DashboardTaskStatus;
	filePaths: string[];
	dependencies: number[];
	claimedBy: string | null;
	resultSummary: string | null;
	filesModified: string[];
	error: string | null;
	iteration: number;
	judgeFeedback: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ApiSuccessEnvelope<T> {
	ok: true;
	data: T;
}

export interface ApiErrorInfo {
	code: string;
	message: string;
}

export interface ApiErrorEnvelope {
	ok: false;
	error: ApiErrorInfo;
}
