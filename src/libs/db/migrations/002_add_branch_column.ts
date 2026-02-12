import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

export const addBranchColumn: Migration = {
	name: "002_add_branch_column",
	up: (db: Database) => {
		db.exec(`ALTER TABLE swarms ADD COLUMN branch TEXT`);
	},
	down: (_db: Database) => {
		// SQLite doesn't support dropping columns directly
		// We'd need to recreate the table, but for now just log
		console.log(
			"Note: SQLite doesn't support DROP COLUMN. Manual intervention needed to revert.",
		);
	},
};
