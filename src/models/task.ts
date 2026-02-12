export type TaskStatus =
	| "pending"
	| "in_progress"
	| "completed"
	| "failed"
	| "blocked";

export interface TaskResult {
	summary: string;
	filesModified: string[];
	error?: string;
}

export interface Task {
	id: number;
	title: string;
	description: string;
	status: TaskStatus;
	filePaths: string[];
	dependencies: number[];
	claimedBy: string | null;
	result: TaskResult | null;
	iteration: number;
	judgeFeedback?: string;
}

export interface BoardSummary {
	total: number;
	pending: number;
	inProgress: number;
	completed: number;
	failed: number;
	blocked: number;
}
