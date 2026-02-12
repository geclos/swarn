#!/usr/bin/env bun

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { SWARN_DB, SWARN_HOME } from "../src/config.js";
import {
	getAppliedMigrations,
	getMigrationStatus,
	type Migration,
	removeMigrationRecord,
	runMigrations,
} from "../src/libs/db/migrate.js";
import { migrations } from "../src/libs/db/setup.js";

function printUsage() {
	console.log(`Usage: bun run scripts/migrate.ts <command> [options]

Commands:
  status              Show migration status (applied vs pending)
  pending             List only pending (not yet applied) migrations
  up                  Run all pending migrations
  up --dry-run        Show what migrations would run without executing
  down                Revert the last applied migration
  down <name>         Revert migrations down to and including <name>
  down --all          Revert all migrations

Examples:
  bun run scripts/migrate.ts status
  bun run scripts/migrate.ts pending
  bun run scripts/migrate.ts up
  bun run scripts/migrate.ts up --dry-run
  bun run scripts/migrate.ts down
  bun run scripts/migrate.ts down 001_initial_schema
`);
}

function initDb(): Database {
	mkdirSync(SWARN_HOME, { recursive: true });
	const db = new Database(SWARN_DB);
	db.exec("PRAGMA journal_mode=WAL");
	db.exec("PRAGMA busy_timeout=5000");
	return db;
}

function rollbackAllMigrations(db: Database, migrationsList: Migration[]) {
	const applied = getAppliedMigrations(db);

	// Run all applied migrations down in reverse order
	const reversed = [...migrationsList].reverse();
	for (const migration of reversed) {
		if (!applied.has(migration.name)) continue;

		console.log(`  ↓ ${migration.name}`);
		migration.down(db);
		removeMigrationRecord(db, migration.name);
	}
}

function showStatus(db: Database) {
	const status = getMigrationStatus(db, migrations);

	console.log("Migration Status\n");
	console.log(
		`Total: ${status.total} | Applied: ${status.applied} | Pending: ${status.pending}\n`,
	);

	if (status.migrations.length === 0) {
		console.log("No migrations found.");
		return;
	}

	console.log("Migrations:");
	for (const m of status.migrations) {
		const symbol = m.applied ? "✓" : "○";
		const date = m.appliedAt ? ` (${m.appliedAt})` : "";
		console.log(`  ${symbol} ${m.name}${date}`);
	}

	if (status.pending > 0) {
		console.log(
			`\n${status.pending} migration(s) pending. Run 'bun run scripts/migrate.ts up' to apply.`,
		);
	}
}

function showPending(db: Database) {
	const status = getMigrationStatus(db, migrations);
	const pending = status.migrations.filter((m) => !m.applied);

	if (pending.length === 0) {
		console.log("No pending migrations. Database is up to date.");
		return;
	}

	console.log(`Pending migrations (${pending.length}):\n`);
	for (const m of pending) {
		console.log(`  ○ ${m.name}`);
	}
}

function runUp(db: Database, dryRun = false) {
	const status = getMigrationStatus(db, migrations);
	const pending = status.migrations.filter((m) => !m.applied);

	if (pending.length === 0) {
		console.log("No pending migrations. Database is up to date.");
		return;
	}

	if (dryRun) {
		console.log("Dry run - would apply the following migrations:\n");
		for (const m of pending) {
			console.log(`  → ${m.name}`);
		}
		console.log(`\nTotal: ${pending.length} migration(s)`);
		return;
	}

	console.log(`Applying ${pending.length} migration(s)...\n`);
	runMigrations(db, migrations, "up");
	console.log("\n✓ Migrations complete!");
}

function runDown(db: Database, target?: string) {
	const status = getMigrationStatus(db, migrations);

	if (status.applied === 0) {
		console.log("No applied migrations to revert.");
		return;
	}

	if (target === "--all") {
		console.log(`Reverting all ${status.applied} migration(s)...\n`);
		rollbackAllMigrations(db, migrations);
		console.log("\n✓ All migrations reverted!");
		return;
	}

	if (target) {
		// Check if target exists in applied migrations
		const targetApplied = status.migrations.find(
			(m) => m.name === target && m.applied,
		);
		if (!targetApplied) {
			console.error(
				`Error: Migration '${target}' not found in applied migrations.`,
			);
			console.log("\nApplied migrations:");
			for (const m of status.migrations.filter((m) => m.applied)) {
				console.log(`  - ${m.name}`);
			}
			process.exit(1);
		}

		// Find which migrations will be reverted
		const appliedMigrations = status.migrations.filter((m) => m.applied);
		const targetIndex = appliedMigrations.findIndex((m) => m.name === target);
		const toRevert = appliedMigrations.slice(targetIndex);

		console.log(
			`Reverting ${toRevert.length} migration(s) down to '${target}'...\n`,
		);
		for (const m of toRevert) {
			console.log(`  ↓ ${m.name}`);
		}
		console.log("");

		runMigrations(db, migrations, "down", target);
		console.log("\n✓ Rollback complete!");
		return;
	}

	// No target - revert last migration only
	const lastApplied = status.migrations.filter((m) => m.applied).pop();

	if (!lastApplied) {
		console.log("No migrations to revert.");
		return;
	}

	console.log(`Reverting last migration: ${lastApplied.name}\n`);
	runMigrations(db, migrations, "down", lastApplied.name);
	console.log("\n✓ Reverted!");
}

function main() {
	const args = process.argv.slice(2);
	const command = args[0];

	if (!command || command === "--help" || command === "-h") {
		printUsage();
		process.exit(0);
	}

	const db = initDb();

	try {
		switch (command) {
			case "status":
				showStatus(db);
				break;
			case "pending":
				showPending(db);
				break;
			case "up": {
				const dryRun = args.includes("--dry-run");
				runUp(db, dryRun);
				break;
			}
			case "down": {
				const target = args[1];
				runDown(db, target);
				break;
			}
			default:
				console.error(`Unknown command: ${command}`);
				printUsage();
				process.exit(1);
		}
	} finally {
		db.close();
	}
}

main();
