import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { SWARN_DB } from "../../config.js";

const READ_ONLY_OPEN_OPTIONS = {
	readonly: true,
	create: false,
} as unknown as ConstructorParameters<typeof Database>[1];

function openDashboardDb(): Database | null {
	if (!existsSync(SWARN_DB)) {
		return null;
	}

	try {
		const sqlite = new Database(SWARN_DB, READ_ONLY_OPEN_OPTIONS);
		sqlite.exec("PRAGMA query_only = ON");
		sqlite.exec("PRAGMA busy_timeout = 1000");
		return sqlite;
	} catch {
		return null;
	}
}

export function withDashboardDb<T>(
	query: (sqlite: Database) => T,
	fallbackValue: T,
): T {
	const sqlite = openDashboardDb();
	if (!sqlite) {
		return fallbackValue;
	}

	try {
		return query(sqlite);
	} finally {
		sqlite.close();
	}
}
