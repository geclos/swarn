import { Database } from "bun:sqlite";
import { afterAll, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initialSchema } from "../../../libs/db/migrations/001_initial_schema.js";

const testHome = mkdtempSync(join(tmpdir(), "swarn-dashboard-swarms-test-"));
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

const { getSwarmDetail, listSwarms } = await import("./swarms.js");

afterAll(() => {
	rmSync(testHome, { recursive: true, force: true });
});

describe("swarms repository", () => {
	test("returns an empty list for an existing but empty database", () => {
		resetDb();

		expect(listSwarms()).toEqual([]);
	});

	test("falls back to null for malformed plan and config JSON", () => {
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
				"/repo/project",
				"main",
				"{bad-json",
				"not-json",
				3,
				2200,
				"2026-01-01T00:00:00.000Z",
				"2026-01-01T00:00:00.000Z",
			);
		sqlite.close();

		const detail = getSwarmDetail(1);
		expect(detail).not.toBeNull();
		expect(detail?.plan).toBeNull();
		expect(detail?.config).toBeNull();
	});
});

function resetDb(): void {
	mkdirSync(testHome, { recursive: true });
	rmSync(dbPath, { force: true });
	const sqlite = new Database(dbPath);
	initialSchema.up(sqlite);
	sqlite.close();
}
