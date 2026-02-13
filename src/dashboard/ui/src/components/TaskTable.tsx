import { createMemo, For, Show } from "solid-js";
import type { TaskDetailDto } from "../lib/types.js";
import { StatusChip } from "./StatusChip.js";
import { type TaskDependencyReference, TaskRow } from "./TaskRow.js";

interface TaskTableProps {
	tasks: TaskDetailDto[];
}

function resolveDependencies(
	task: TaskDetailDto,
	lookup: Map<number, TaskDetailDto>,
): TaskDependencyReference[] {
	return task.dependencies.map((dependencyId) => {
		const dependencyTask = lookup.get(dependencyId);
		if (!dependencyTask) {
			return {
				id: dependencyId,
				label: `Task #${dependencyId}`,
				missing: true,
			};
		}

		return {
			id: dependencyTask.id,
			label: `Task #${dependencyTask.id}: ${dependencyTask.title}`,
			missing: false,
		};
	});
}

function dependencyLabel(references: TaskDependencyReference[]): string {
	if (references.length === 0) {
		return "None";
	}

	return references
		.map((reference) =>
			reference.missing ? `${reference.label} (missing)` : reference.label,
		)
		.join(", ");
}

function listValue(values: string[]): string {
	if (values.length === 0) {
		return "--";
	}

	return values.join(", ");
}

export function TaskTable(props: TaskTableProps) {
	const orderedTasks = createMemo(() => {
		const tasks = [...props.tasks];
		tasks.sort((left, right) => left.id - right.id);
		return tasks;
	});

	const taskLookup = createMemo(() => {
		const lookup = new Map<number, TaskDetailDto>();
		for (const task of orderedTasks()) {
			lookup.set(task.id, task);
		}

		return lookup;
	});

	return (
		<>
			<Show when={orderedTasks().length === 0}>
				<div class="ui-state">
					<h2>No tasks assigned</h2>
					<p>This swarm has not produced task records yet.</p>
				</div>
			</Show>

			<Show when={orderedTasks().length > 0}>
				<div class="surface table-surface desktop-only">
					<table class="swarm-table">
						<thead>
							<tr>
								<th>Title</th>
								<th>Status</th>
								<th>Dependencies</th>
								<th>Claimed by</th>
								<th>Iteration</th>
								<th>File paths</th>
							</tr>
						</thead>
						<tbody>
							<For each={orderedTasks()}>
								{(task) => (
									<TaskRow
										task={task}
										dependencies={resolveDependencies(task, taskLookup())}
									/>
								)}
							</For>
						</tbody>
					</table>
				</div>

				<div class="mobile-stack">
					<For each={orderedTasks()}>
						{(task) => {
							const dependencies = () =>
								resolveDependencies(task, taskLookup());
							return (
								<details class="surface swarm-card">
									<summary class="swarm-card-header">
										<h3>{task.title}</h3>
										<StatusChip status={task.status} />
									</summary>
									<div class="swarm-card-metrics">
										<span class="mono-value">
											Dependencies {dependencyLabel(dependencies())}
										</span>
										<span class="mono-value">
											Claimed by {task.claimedBy ?? "unclaimed"}
										</span>
										<span>Iteration {task.iteration}</span>
										<span class="mono-value">
											File paths {listValue(task.filePaths)}
										</span>
										<span>Description {task.description || "--"}</span>
										<span>
											Result summary {task.resultSummary ?? "No result summary"}
										</span>
										<span class="mono-value">
											Files modified {listValue(task.filesModified)}
										</span>
										<span>Error {task.error ?? "None"}</span>
										<span>Judge feedback {task.judgeFeedback ?? "None"}</span>
									</div>
								</details>
							);
						}}
					</For>
				</div>
			</Show>
		</>
	);
}
