import { integer, primaryKey, sqliteTable } from "drizzle-orm/sqlite-core";
import { tasks } from "./tasks.js";

export const taskDeps = sqliteTable(
	"task_deps",
	{
		taskId: integer("task_id")
			.notNull()
			.references(() => tasks.id),
		dependsOn: integer("depends_on")
			.notNull()
			.references(() => tasks.id),
	},
	(table) => [primaryKey({ columns: [table.taskId, table.dependsOn] })],
);

export interface TaskDepRow {
	task_id: number;
	depends_on: number;
}
