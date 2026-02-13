import { Database } from "bun:sqlite";
import { afterAll, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initialSchema } from "../../../libs/db/migrations/001_initial_schema.js";

const testHome = mkdtempSync(join(tmpdir(), "swarn-dashboard-tasks-test-"));
const dbPath = join(testHome, "swarm.db");

mock.module("../db.js", () => ({
	withDashboardDb<T>(query: (sqlite: Database) => T, fallbackValue: T): T {
		if (!existsSync(dbPath)) {
			return fallbackValue;
		}

		const sqlite = new Database(dbPath, {
			readonly: true,
			create: false,
		});
		try {
			return query(sqlite);
		} finally {
			sqlite.close();
		}
	},
}));

const { listTasksBySwarmId } = await import("./tasks.js");

afterAll(() => {
	rmSync(testHome, { recursive: true, force: true });
});

describe("tasks repository", () => {
	test("expands task dependencies from task_deps rows", () => {
		resetDb();

		const sqlite = new Database(dbPath);
		insertSwarm(sqlite);

		sqlite
			.prepare(
				`INSERT INTO tasks (
				id,
				swarm_id,
				title,
				description,
				status,
				file_paths,
				created_at,
				updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				1,
				1,
				"Task 1",
				"Bootstrap",
				"completed",
				"[]",
				"2026-01-01T00:00:00.000Z",
				"2026-01-01T00:00:00.000Z",
			);

		sqlite
			.prepare(
				`INSERT INTO tasks (
				id,
				swarm_id,
				title,
				description,
				status,
				file_paths,
				created_at,
				updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				2,
				1,
				"Task 2",
				"API",
				"completed",
				"[]",
				"2026-01-01T01:00:00.000Z",
				"2026-01-01T01:00:00.000Z",
			);

		sqlite
			.prepare(
				`INSERT INTO tasks (
				id,
				swarm_id,
				title,
				description,
				status,
				file_paths,
				created_at,
				updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				3,
				1,
				"Task 3",
				"Integration",
				"pending",
				"[]",
				"2026-01-01T02:00:00.000Z",
				"2026-01-01T02:00:00.000Z",
			);

		sqlite
			.prepare("INSERT INTO task_deps (task_id, depends_on) VALUES (?, ?)")
			.run(3, 1);
		sqlite
			.prepare("INSERT INTO task_deps (task_id, depends_on) VALUES (?, ?)")
			.run(3, 2);
		sqlite.close();

		const tasks = listTasksBySwarmId(1);
		expect(tasks).toHaveLength(3);
		expect(tasks[2]?.dependencies).toEqual([1, 2]);
	});

	test("falls back to empty arrays for malformed JSON array columns", () => {
		resetDb();

		const sqlite = new Database(dbPath);
		insertSwarm(sqlite);

		sqlite
			.prepare(
				`INSERT INTO tasks (
				id,
				swarm_id,
				title,
				description,
				status,
				file_paths,
				files_modified,
				created_at,
				updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				1,
				1,
				"Task with malformed arrays",
				"Validate fallback behavior",
				"failed",
				"{bad-json",
				"123",
				"2026-01-01T00:00:00.000Z",
				"2026-01-01T00:00:00.000Z",
			);
		sqlite.close();

		const task = listTasksBySwarmId(1)[0];
		expect(task).toBeDefined();
		expect(task?.filePaths).toEqual([]);
		expect(task?.filesModified).toEqual([]);
	});
});

function resetDb(): void {
	mkdirSync(testHome, { recursive: true });
	rmSync(dbPath, { force: true });
	const sqlite = new Database(dbPath);
	initialSchema.up(sqlite);
	sqlite.close();
}

function insertSwarm(sqlite: Database): void {
	sqlite
		.prepare(
			`INSERT INTO swarms (
			id,
			status,
			working_dir,
			branch,
			plan,
			config,
			max_iterations,
			pid,
			created_at,
			updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(
			1,
			"running",
			"/repo/project",
			"main",
			"[]",
			"{}",
			3,
			3300,
			"2026-01-01T00:00:00.000Z",
			"2026-01-01T00:00:00.000Z",
		);
}
