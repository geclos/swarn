#!/usr/bin/env bun

import { Database } from "bun:sqlite";
import { SWARN_DB } from "../src/config.js";

const db = new Database(SWARN_DB);

console.log("Tables:");
const tables = db
	.prepare("SELECT name FROM sqlite_master WHERE type='table'")
	.all() as { name: string }[];
for (const t of tables) {
	console.log(`  - ${t.name}`);
}

console.log("\nSwarms table columns:");
const columns = db.prepare("PRAGMA table_info(swarms)").all() as {
	name: string;
	type: string;
}[];
for (const c of columns) {
	console.log(`  - ${c.name}: ${c.type}`);
}

db.close();
