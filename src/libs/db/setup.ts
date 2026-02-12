import type { Database } from "bun:sqlite";
import { runMigrations } from "./migrate.js";
import { initialSchema } from "./migrations/001_initial_schema.js";
import { addBranchColumn } from "./migrations/002_add_branch_column.js";

export const migrations = [initialSchema, addBranchColumn];

export function ensureTables(sqlite: Database): void {
	runMigrations(sqlite, migrations, "up");
}

export function rollbackMigration(sqlite: Database, target?: string): void {
	runMigrations(sqlite, migrations, "down", target);
}

export function listMigrations(sqlite: Database): {
	name: string;
	applied: boolean;
}[] {
	const { getAppliedMigrations } = require("./migrate.js");
	const applied = getAppliedMigrations(sqlite);
	return migrations.map((m) => ({
		name: m.name,
		applied: applied.has(m.name),
	}));
}
