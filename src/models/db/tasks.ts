import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { swarms } from "./swarms.js";

export const tasks = sqliteTable("tasks", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	swarmId: integer("swarm_id")
		.notNull()
		.references(() => swarms.id),
	title: text("title").notNull(),
	description: text("description").notNull(),
	status: text("status").notNull(),
	filePaths: text("file_paths").notNull(),
	claimedBy: text("claimed_by"),
	resultSummary: text("result_summary"),
	filesModified: text("files_modified"),
	error: text("error"),
	iteration: integer("iteration").notNull().default(0),
	judgeFeedback: text("judge_feedback"),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});

export interface TaskRow {
	id: number;
	swarm_id: number;
	title: string;
	description: string;
	status: string;
	file_paths: string;
	claimed_by: string | null;
	result_summary: string | null;
	files_modified: string | null;
	error: string | null;
	iteration: number;
	judge_feedback: string | null;
	created_at: string;
	updated_at: string;
}
