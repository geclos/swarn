import { Database } from "bun:sqlite";
import { afterAll, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initialSchema } from "../libs/db/migrations/001_initial_schema.js";

const testHome = mkdtempSync(join(tmpdir(), "swarn-dashboard-server-test-"));
const dbPath = join(testHome, "swarm.db");

mock.module("./api/db.js", () => ({
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

const { handleApiRequest } = await import("./api/routes.js");

afterAll(() => {
	rmSync(testHome, { recursive: true, force: true });
});

describe("dashboard API routes", () => {
	test("returns an empty swarm list when the dashboard DB is missing", async () => {
		rmSync(dbPath, { force: true });

		const response = handleApiRequest(
			new Request("http://localhost/api/swarms"),
			new URL("http://localhost/api/swarms"),
		);

		expect(response).not.toBeNull();
		expect(response?.status).toBe(200);
		expect(await response?.json()).toEqual({ ok: true, data: [] });
	});

	test("GET /api/swarms returns swarms ordered by created_at descending", async () => {
		resetDb();

		const sqlite = new Database(dbPath);
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
				"/repo/older",
				"main",
				"[]",
				"{}",
				3,
				1200,
				"2026-01-01T00:00:00.000Z",
				"2026-01-01T00:00:00.000Z",
			);

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
				2,
				"completed",
				"/repo/newer",
				null,
				"[]",
				"{}",
				3,
				1201,
				"2026-01-02T00:00:00.000Z",
				"2026-01-02T00:00:00.000Z",
			);
		sqlite.close();

		const response = handleApiRequest(
			new Request("http://localhost/api/swarms"),
			new URL("http://localhost/api/swarms"),
		);

		expect(response).not.toBeNull();
		expect(response?.status).toBe(200);

		const payload = (await response?.json()) as {
			ok: boolean;
			data: Array<{ id: number; workingDir: string }>;
		};
		expect(payload.ok).toBe(true);
		expect(payload.data.map((item) => item.id)).toEqual([2, 1]);
		expect(payload.data.map((item) => item.workingDir)).toEqual([
			"/repo/newer",
			"/repo/older",
		]);
	});

	test("GET /api/swarms/:id returns 404 when swarm does not exist", async () => {
		resetDb();

		const response = handleApiRequest(
			new Request("http://localhost/api/swarms/999"),
			new URL("http://localhost/api/swarms/999"),
		);

		expect(response).not.toBeNull();
		expect(response?.status).toBe(404);
		expect(await response?.json()).toEqual({
			ok: false,
			error: {
				code: "SWARM_NOT_FOUND",
				message: "Swarm not found",
			},
		});
	});
});

function resetDb(): void {
	mkdirSync(testHome, { recursive: true });
	rmSync(dbPath, { force: true });
	const sqlite = new Database(dbPath);
	initialSchema.up(sqlite);
	sqlite.close();
}
