import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import type { TaskDetailDto } from "../lib/types.js";
import { StatusChip } from "./StatusChip.js";

const expandedTaskRows = new Map<number, boolean>();

export interface TaskDependencyReference {
	id: number;
	label: string;
	missing: boolean;
}

interface TaskRowProps {
	task: TaskDetailDto;
	dependencies: TaskDependencyReference[];
}

export function TaskRow(props: TaskRowProps) {
	const taskId = createMemo(() => props.task.id);
	const detailsRowId = createMemo(() => `task-${taskId()}-details`);
	const [expanded, setExpanded] = createSignal(
		expandedTaskRows.get(taskId()) ?? false,
	);

	createEffect(() => {
		const id = taskId();
		setExpanded(expandedTaskRows.get(id) ?? false);
	});

	createEffect(() => {
		expandedTaskRows.set(taskId(), expanded());
	});

	const dependencyValue = createMemo(() => {
		if (props.dependencies.length === 0) {
			return "None";
		}

		return props.dependencies
			.map((dependency) =>
				dependency.missing ? `${dependency.label} (missing)` : dependency.label,
			)
			.join(", ");
	});

	const filePathValue = createMemo(() => {
		if (props.task.filePaths.length === 0) {
			return "--";
		}

		return props.task.filePaths.join(", ");
	});

	const filesModifiedValue = createMemo(() => {
		if (props.task.filesModified.length === 0) {
			return "None";
		}

		return props.task.filesModified.join(", ");
	});

	return (
		<>
			<tr>
				<td>
					<div class="swarm-card-metrics">
						<button
							class="task-row-toggle"
							type="button"
							onClick={() => setExpanded((value) => !value)}
							aria-expanded={expanded()}
							aria-controls={detailsRowId()}
						>
							{expanded() ? "Hide details" : "Show details"}
						</button>
						<strong>{props.task.title}</strong>
					</div>
				</td>
				<td>
					<StatusChip status={props.task.status} />
				</td>
				<td class="mono-value task-row-primary">{dependencyValue()}</td>
				<td class="mono-value task-row-primary">
					{props.task.claimedBy ?? "unclaimed"}
				</td>
				<td>{props.task.iteration}</td>
				<td class="mono-value task-row-primary">{filePathValue()}</td>
			</tr>

			<Show when={expanded()}>
				<tr>
					<td colSpan={6} id={detailsRowId()} class="task-row-detail-cell">
						<div class="swarm-card-metrics task-detail-grid">
							<p class="task-detail-item">
								<strong>Description:</strong>
								<span class="task-detail-value">
									{props.task.description || "--"}
								</span>
							</p>
							<p class="task-detail-item">
								<strong>Result summary:</strong>
								<span class="task-detail-value">
									{props.task.resultSummary ?? "No result summary"}
								</span>
							</p>
							<p class="task-detail-item">
								<strong>Files modified:</strong>
								<span class="task-detail-value mono-value">
									{filesModifiedValue()}
								</span>
							</p>
							<p class="task-detail-item">
								<strong>Error:</strong>
								<span class="task-detail-value mono-value">
									{props.task.error ?? "None"}
								</span>
							</p>
							<p class="task-detail-item">
								<strong>Judge feedback:</strong>
								<span class="task-detail-value mono-value">
									{props.task.judgeFeedback ?? "None"}
								</span>
							</p>
							<Show when={props.dependencies.length > 0}>
								<div class="task-detail-item">
									<strong>Dependencies:</strong>
									<ul class="task-dependency-list">
										<For each={props.dependencies}>
											{(dependency) => (
												<li class="mono-value">
													{dependency.label}
													<Show when={dependency.missing}> (missing)</Show>
												</li>
											)}
										</For>
									</ul>
								</div>
							</Show>
						</div>
					</td>
				</tr>
			</Show>
		</>
	);
}
