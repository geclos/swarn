import type { SwarmRow } from "./db/swarms.js";
import type { Task } from "./task.js";

export type SwarmStatus = "running" | "completed" | "failed" | "stopped";

export interface PlanTask {
	id: string;
	title: string;
	description: string;
	filePaths?: string[];
	dependencies?: string[];
}

export interface SwarnConfig {
	planSource: string | null; // file path, inline JSON, or null for stdin
	maxWorkers: number;
	maxIterations: number;
	model: { providerID: string; modelID: string } | null;
	workingDir: string;
	serverUrl: string;
	verbose: boolean;
}

export interface JudgeVerdict {
	verdict: "done" | "iterate";
	score: number;
	feedback: string;
	failedTasks: Array<{
		taskId: number;
		reason: string;
		suggestion: string;
	}>;
}

export interface RunStats {
	iterations: number;
	tasksCompleted: number;
	tasksFailed: number;
	totalTokens: { input: number; output: number };
	totalCost: number;
	filesChanged: string[];
	duration: number;
}

export interface ProgressStats {
	iteration?: number;
	tokensIn?: number;
	tokensOut?: number;
	cost?: number;
}

export interface SwarmRecord extends SwarmRow {
	tasks?: Task[];
}
