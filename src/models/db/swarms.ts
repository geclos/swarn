import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { SwarmStatus } from "../swarn.js";

export const swarms = sqliteTable("swarms", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	status: text("status").notNull(),
	workingDir: text("working_dir").notNull(),
	branch: text("branch"),
	plan: text("plan").notNull(),
	config: text("config").notNull(),
	iteration: integer("iteration").notNull().default(0),
	maxIterations: integer("max_iterations").notNull(),
	tasksTotal: integer("tasks_total").notNull().default(0),
	tasksCompleted: integer("tasks_completed").notNull().default(0),
	tasksFailed: integer("tasks_failed").notNull().default(0),
	tokensIn: integer("tokens_in").notNull().default(0),
	tokensOut: integer("tokens_out").notNull().default(0),
	cost: real("cost").notNull().default(0),
	error: text("error"),
	pid: integer("pid").notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});

export interface SwarmRow {
	id: number;
	status: SwarmStatus;
	workingDir: string;
	branch: string | null;
	plan: string;
	config: string;
	iteration: number;
	maxIterations: number;
	tasksTotal: number;
	tasksCompleted: number;
	tasksFailed: number;
	tokensIn: number;
	tokensOut: number;
	cost: number;
	error: string | null;
	pid: number;
	createdAt: string;
	updatedAt: string;
}
