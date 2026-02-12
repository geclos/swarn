import type { Database } from "bun:sqlite";

export interface Migration {
	name: string;
	up: (db: Database) => void;
	down: (db: Database) => void;
}

export interface MigrationStatus {
	name: string;
	applied: boolean;
	appliedAt?: string;
}

export interface MigrationReport {
	migrations: MigrationStatus[];
	total: number;
	applied: number;
	pending: number;
}

interface MigrationRecord {
	name: string;
	applied_at: string;
}

export function createMigrationsTable(db: Database): void {
	db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
}

export function getAppliedMigrations(db: Database): Map<string, string> {
	createMigrationsTable(db);
	const rows = db
		.prepare("SELECT name, applied_at FROM migrations")
		.all() as MigrationRecord[];
	return new Map(rows.map((r) => [r.name, r.applied_at]));
}

export function recordMigration(db: Database, name: string): void {
	const now = new Date().toISOString();
	db.prepare("INSERT INTO migrations (name, applied_at) VALUES (?, ?)").run(
		name,
		now,
	);
}

export function removeMigrationRecord(db: Database, name: string): void {
	db.prepare("DELETE FROM migrations WHERE name = ?").run(name);
}

export function getMigrationStatus(
	db: Database,
	migrations: Migration[],
): MigrationReport {
	createMigrationsTable(db);
	const applied = getAppliedMigrations(db);

	const status: MigrationStatus[] = migrations.map((m) => ({
		name: m.name,
		applied: applied.has(m.name),
		appliedAt: applied.get(m.name),
	}));

	return {
		migrations: status,
		total: migrations.length,
		applied: status.filter((m) => m.applied).length,
		pending: status.filter((m) => !m.applied).length,
	};
}

export function runMigrations(
	db: Database,
	migrations: Migration[],
	direction: "up" | "down" = "up",
	target?: string,
): void {
	createMigrationsTable(db);
	const applied = getAppliedMigrations(db);

	if (direction === "up") {
		for (const migration of migrations) {
			if (applied.has(migration.name)) continue;
			if (target && migration.name !== target) continue;

			console.log(`  → ${migration.name}`);
			migration.up(db);
			recordMigration(db, migration.name);

			if (target) break;
		}
	} else {
		// down: run in reverse order
		const reversed = [...migrations].reverse();
		for (const migration of reversed) {
			if (!applied.has(migration.name)) continue;
			if (target && migration.name !== target) continue;

			console.log(`  ↓ ${migration.name}`);
			migration.down(db);
			removeMigrationRecord(db, migration.name);

			if (target) break;
		}
	}
}

export function rollbackMigrations(
	db: Database,
	migrations: Migration[],
): void {
	createMigrationsTable(db);
	const applied = getAppliedMigrations(db);

	// Run all applied migrations down in reverse order
	const reversed = [...migrations].reverse();
	for (const migration of reversed) {
		if (!applied.has(migration.name)) continue;

		console.log(`  ↓ ${migration.name}`);
		migration.down(db);
		removeMigrationRecord(db, migration.name);
	}
}
