import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

export const initialSchema: Migration = {
	name: "001_initial_schema",
	up: (db: Database) => {
		db.exec(`
      CREATE TABLE IF NOT EXISTS swarms (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        status          TEXT NOT NULL,
        working_dir     TEXT NOT NULL,
        branch          TEXT,
        plan            TEXT NOT NULL,
        config          TEXT NOT NULL,
        iteration       INTEGER NOT NULL DEFAULT 0,
        max_iterations  INTEGER NOT NULL,
        tasks_total     INTEGER NOT NULL DEFAULT 0,
        tasks_completed INTEGER NOT NULL DEFAULT 0,
        tasks_failed    INTEGER NOT NULL DEFAULT 0,
        tokens_in       INTEGER NOT NULL DEFAULT 0,
        tokens_out      INTEGER NOT NULL DEFAULT 0,
        cost            REAL NOT NULL DEFAULT 0,
        error           TEXT,
        pid             INTEGER NOT NULL,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      )
    `);

		db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        swarm_id        INTEGER NOT NULL REFERENCES swarms(id),
        title           TEXT NOT NULL,
        description     TEXT NOT NULL,
        status          TEXT NOT NULL,
        file_paths      TEXT NOT NULL,
        claimed_by      TEXT,
        result_summary  TEXT,
        files_modified  TEXT,
        error           TEXT,
        iteration       INTEGER NOT NULL DEFAULT 0,
        judge_feedback  TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      )
    `);

		db.exec(`
      CREATE TABLE IF NOT EXISTS task_deps (
        task_id        INTEGER NOT NULL REFERENCES tasks(id),
        depends_on     INTEGER NOT NULL REFERENCES tasks(id),
        PRIMARY KEY (task_id, depends_on)
      )
    `);
	},
	down: (db: Database) => {
		db.exec(`DROP TABLE IF EXISTS task_deps`);
		db.exec(`DROP TABLE IF EXISTS tasks`);
		db.exec(`DROP TABLE IF EXISTS swarms`);
	},
};
