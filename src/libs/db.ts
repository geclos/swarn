import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { SWARN_DB, SWARN_HOME } from "../config.js";
import { ensureTables } from "./db/setup.js";

export interface DbClient {
	sqlite: Database;
	db: ReturnType<typeof drizzle>;
}

export function initDb(): DbClient {
	mkdirSync(SWARN_HOME, { recursive: true });
	const sqlite = new Database(SWARN_DB);
	sqlite.exec("PRAGMA journal_mode=WAL");
	sqlite.exec("PRAGMA busy_timeout=5000");
	ensureTables(sqlite);
	return { sqlite, db: drizzle(sqlite) };
}

export function closeDb(client: DbClient): void {
	client.sqlite.close();
}
