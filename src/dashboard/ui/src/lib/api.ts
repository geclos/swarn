import type {
	ApiErrorEnvelope,
	ApiErrorInfo,
	ApiSuccessEnvelope,
	DashboardSwarmStatus,
	DashboardTaskStatus,
	ProgressRatios,
	StatusCounts,
	SwarmDetailDto,
	SwarmListItemDto,
	TaskDetailDto,
} from "./types.js";

const API_BASE_PATH = "/api";

export interface ApiRequestOptions {
	signal?: AbortSignal;
}

export class DashboardApiError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(message: string, status: number, code: string) {
		super(message);
		this.name = "DashboardApiError";
		this.status = status;
		this.code = code;
	}
}

export async function listSwarms(
	options: ApiRequestOptions = {},
): Promise<SwarmListItemDto[]> {
	return requestJson("/swarms", parseSwarmList, options);
}

export async function getSwarmDetail(
	swarmId: number,
	options: ApiRequestOptions = {},
): Promise<SwarmDetailDto> {
	return requestJson(
		`/swarms/${parseSwarmId(swarmId)}`,
		parseSwarmDetail,
		options,
	);
}

export async function listSwarmTasks(
	swarmId: number,
	options: ApiRequestOptions = {},
): Promise<TaskDetailDto[]> {
	return requestJson(
		`/swarms/${parseSwarmId(swarmId)}/tasks`,
		parseTaskList,
		options,
	);
}

async function requestJson<T>(
	path: string,
	parseData: (value: unknown) => T,
	options: ApiRequestOptions,
): Promise<T> {
	let response: Response;

	try {
		response = await fetch(`${API_BASE_PATH}${path}`, {
			method: "GET",
			headers: {
				accept: "application/json",
			},
			signal: options.signal,
		});
	} catch (error) {
		if (isAbortError(error)) {
			throw error;
		}

		throw new DashboardApiError("Network request failed", 0, "NETWORK_ERROR");
	}

	const payload = await readJson(response);

	if (!response.ok) {
		const errorInfo = readApiError(payload);
		throw new DashboardApiError(
			errorInfo?.message ?? `Request failed with status ${response.status}`,
			response.status,
			errorInfo?.code ?? "REQUEST_FAILED",
		);
	}

	if (!isApiSuccessEnvelope(payload)) {
		throw new DashboardApiError(
			"Invalid success payload from API",
			response.status,
			"INVALID_RESPONSE",
		);
	}

	try {
		return parseData(payload.data);
	} catch (error) {
		if (error instanceof DashboardApiError) {
			throw error;
		}

		throw new DashboardApiError(
			"Failed to parse API response",
			response.status,
			"INVALID_RESPONSE",
		);
	}
}

async function readJson(response: Response): Promise<unknown> {
	try {
		return (await response.json()) as unknown;
	} catch {
		return null;
	}
}

function parseSwarmId(value: number): number {
	if (!Number.isInteger(value) || value <= 0) {
		throw new DashboardApiError(
			"Swarm id must be a positive integer",
			0,
			"INVALID_INPUT",
		);
	}

	return value;
}

function parseSwarmList(value: unknown): SwarmListItemDto[] {
	if (!Array.isArray(value)) {
		throw new DashboardApiError(
			"Invalid swarm list payload",
			200,
			"INVALID_RESPONSE",
		);
	}

	return value.map((item) => parseSwarmListItem(item));
}

function parseSwarmDetail(value: unknown): SwarmDetailDto {
	const base = parseSwarmListItem(value);
	const object = expectRecord(value, "swarm detail");

	return {
		...base,
		plan: object.plan,
		config: object.config,
	};
}

function parseTaskList(value: unknown): TaskDetailDto[] {
	if (!Array.isArray(value)) {
		throw new DashboardApiError(
			"Invalid task list payload",
			200,
			"INVALID_RESPONSE",
		);
	}

	return value.map((item) => parseTaskDetail(item));
}

function parseSwarmListItem(value: unknown): SwarmListItemDto {
	const object = expectRecord(value, "swarm item");

	return {
		id: expectNumber(object, "id"),
		status: expectSwarmStatus(object, "status"),
		workingDir: expectString(object, "workingDir"),
		branch: expectNullableString(object, "branch"),
		iteration: expectNumber(object, "iteration"),
		maxIterations: expectNumber(object, "maxIterations"),
		tasksTotal: expectNumber(object, "tasksTotal"),
		tasksCompleted: expectNumber(object, "tasksCompleted"),
		tasksFailed: expectNumber(object, "tasksFailed"),
		tokensIn: expectNumber(object, "tokensIn"),
		tokensOut: expectNumber(object, "tokensOut"),
		cost: expectNumber(object, "cost"),
		error: expectNullableString(object, "error"),
		pid: expectNumber(object, "pid"),
		createdAt: expectString(object, "createdAt"),
		updatedAt: expectString(object, "updatedAt"),
		statusCounts: parseStatusCounts(object.statusCounts),
		progress: parseProgressRatios(object.progress),
	};
}

function parseTaskDetail(value: unknown): TaskDetailDto {
	const object = expectRecord(value, "task item");

	return {
		id: expectNumber(object, "id"),
		swarmId: expectNumber(object, "swarmId"),
		title: expectString(object, "title"),
		description: expectString(object, "description"),
		status: expectTaskStatus(object, "status"),
		filePaths: expectStringArray(object, "filePaths"),
		dependencies: expectNumberArray(object, "dependencies"),
		claimedBy: expectNullableString(object, "claimedBy"),
		resultSummary: expectNullableString(object, "resultSummary"),
		filesModified: expectStringArray(object, "filesModified"),
		error: expectNullableString(object, "error"),
		iteration: expectNumber(object, "iteration"),
		judgeFeedback: expectNullableString(object, "judgeFeedback"),
		createdAt: expectString(object, "createdAt"),
		updatedAt: expectString(object, "updatedAt"),
	};
}

function parseStatusCounts(value: unknown): StatusCounts {
	const object = expectRecord(value, "statusCounts");

	return {
		total: expectNumber(object, "total"),
		pending: expectNumber(object, "pending"),
		inProgress: expectNumber(object, "inProgress"),
		completed: expectNumber(object, "completed"),
		failed: expectNumber(object, "failed"),
		blocked: expectNumber(object, "blocked"),
	};
}

function parseProgressRatios(value: unknown): ProgressRatios {
	const object = expectRecord(value, "progress");

	return {
		completed: expectNumber(object, "completed"),
		failed: expectNumber(object, "failed"),
		resolved: expectNumber(object, "resolved"),
	};
}

function readApiError(value: unknown): ApiErrorInfo | null {
	if (!isApiErrorEnvelope(value)) {
		return null;
	}

	return value.error;
}

function expectRecord(value: unknown, name: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new DashboardApiError(
			`Expected ${name} object`,
			200,
			"INVALID_RESPONSE",
		);
	}

	return value as Record<string, unknown>;
}

function expectString(record: Record<string, unknown>, key: string): string {
	const value = record[key];
	if (typeof value !== "string") {
		throw new DashboardApiError(
			`Expected ${key} to be a string`,
			200,
			"INVALID_RESPONSE",
		);
	}

	return value;
}

function expectNullableString(
	record: Record<string, unknown>,
	key: string,
): string | null {
	const value = record[key];
	if (value === null) {
		return null;
	}

	if (typeof value !== "string") {
		throw new DashboardApiError(
			`Expected ${key} to be a string or null`,
			200,
			"INVALID_RESPONSE",
		);
	}

	return value;
}

function expectNumber(record: Record<string, unknown>, key: string): number {
	const value = record[key];
	if (typeof value !== "number" || Number.isNaN(value)) {
		throw new DashboardApiError(
			`Expected ${key} to be a number`,
			200,
			"INVALID_RESPONSE",
		);
	}

	return value;
}

function expectStringArray(
	record: Record<string, unknown>,
	key: string,
): string[] {
	const value = record[key];
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
		throw new DashboardApiError(
			`Expected ${key} to be a string[]`,
			200,
			"INVALID_RESPONSE",
		);
	}

	return value;
}

function expectNumberArray(
	record: Record<string, unknown>,
	key: string,
): number[] {
	const value = record[key];
	if (
		!Array.isArray(value) ||
		value.some((item) => typeof item !== "number" || Number.isNaN(item))
	) {
		throw new DashboardApiError(
			`Expected ${key} to be a number[]`,
			200,
			"INVALID_RESPONSE",
		);
	}

	return value;
}

function expectSwarmStatus(
	record: Record<string, unknown>,
	key: string,
): DashboardSwarmStatus {
	const value = record[key];
	if (
		value !== "running" &&
		value !== "completed" &&
		value !== "failed" &&
		value !== "stopped"
	) {
		throw new DashboardApiError(
			`Expected ${key} to be a valid swarm status`,
			200,
			"INVALID_RESPONSE",
		);
	}

	return value;
}

function expectTaskStatus(
	record: Record<string, unknown>,
	key: string,
): DashboardTaskStatus {
	const value = record[key];
	if (
		value !== "pending" &&
		value !== "in_progress" &&
		value !== "completed" &&
		value !== "failed" &&
		value !== "blocked"
	) {
		throw new DashboardApiError(
			`Expected ${key} to be a valid task status`,
			200,
			"INVALID_RESPONSE",
		);
	}

	return value;
}

function isApiSuccessEnvelope<T>(
	value: unknown,
): value is ApiSuccessEnvelope<T> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}

	const payload = value as Record<string, unknown>;
	return payload.ok === true && "data" in payload;
}

function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}

	const payload = value as Record<string, unknown>;
	if (payload.ok !== false) {
		return false;
	}

	const error = payload.error;
	if (typeof error !== "object" || error === null || Array.isArray(error)) {
		return false;
	}

	const errorValue = error as Record<string, unknown>;
	return (
		typeof errorValue.code === "string" &&
		typeof errorValue.message === "string"
	);
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}
