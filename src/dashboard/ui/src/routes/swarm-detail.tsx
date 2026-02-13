import { A, useParams } from "@solidjs/router";
import { createMemo, createResource, Show } from "solid-js";
import { ErrorState, Layout, LoadingState } from "../components/Layout.js";
import { StatusChip } from "../components/StatusChip.js";
import { StatusCounts } from "../components/StatusCounts.js";
import { SwarmHeader } from "../components/SwarmHeader.js";
import { TaskTable } from "../components/TaskTable.js";
import { Toolbar } from "../components/Toolbar.js";
import { getSwarmDetail, listSwarmTasks } from "../lib/api.js";
import { createPolling, shouldPollSwarmDetail } from "../lib/polling.js";
import type { SwarmDetailDto, TaskDetailDto } from "../lib/types.js";

interface SwarmPageData {
	swarm: SwarmDetailDto;
	tasks: TaskDetailDto[];
}

async function fetchSwarmPageData(swarmId: number): Promise<SwarmPageData> {
	const [swarm, tasks] = await Promise.all([
		getSwarmDetail(swarmId),
		listSwarmTasks(swarmId),
	]);

	return {
		swarm,
		tasks,
	};
}

export default function SwarmDetailRoute() {
	const params = useParams<{ id: string }>();
	const swarmId = createMemo(() => {
		const id = Number.parseInt(params.id, 10);
		if (!Number.isInteger(id) || id <= 0) {
			return null;
		}

		return id;
	});

	const [data] = createResource(
		() => swarmId(),
		async (id): Promise<SwarmPageData | null> => {
			if (id === null) {
				return null;
			}

			return fetchSwarmPageData(id);
		},
	);

	createPolling({
		enabled: () => shouldPollSwarmDetail(data()?.swarm),
		refresh: async () => {
			await data.refetch();
		},
	});

	return (
		<Layout
			title={`Swarm #${params.id}`}
			subtitle="Inspect swarm metadata and task-level execution details."
			actions={<A href="/">Back to swarms</A>}
		>
			<section class="surface status-legend" aria-label="Status legend">
				<p class="status-legend-title">Status legend</p>
				<div class="status-legend-grid">
					<div class="status-legend-item">
						<StatusChip status="pending" />
						<span>Task is queued and waiting for work.</span>
					</div>
					<div class="status-legend-item">
						<StatusChip status="in_progress" />
						<span>Task execution is actively running.</span>
					</div>
					<div class="status-legend-item">
						<StatusChip status="completed" />
						<span>Task completed without errors.</span>
					</div>
					<div class="status-legend-item">
						<StatusChip status="failed" />
						<span>Task failed and may include an error message.</span>
					</div>
					<div class="status-legend-item">
						<StatusChip status="blocked" />
						<span>Task is blocked by dependencies.</span>
					</div>
				</div>
			</section>

			<Show when={swarmId() === null}>
				<ErrorState
					title="Invalid swarm id"
					message="Swarm id must be a positive integer."
				/>
			</Show>

			<Show when={swarmId() !== null && data.loading}>
				<LoadingState message="Loading swarm details and task explorer." />
			</Show>

			<Show when={swarmId() !== null && data.error}>
				<ErrorState
					title="Could not load this swarm"
					message="The swarm may have been removed or the API is unavailable."
					action={
						<button type="button" onClick={() => data.refetch()}>
							Retry
						</button>
					}
				/>
			</Show>

			<Show when={swarmId() !== null && data()}>
				{(currentData) => (
					<>
						<SwarmHeader swarm={currentData().swarm} />
						<StatusCounts counts={currentData().swarm.statusCounts} />

						<Toolbar
							title="Task explorer"
							description="Inspect each task's dependencies, ownership, and execution output."
						/>

						<TaskTable tasks={currentData().tasks} />
					</>
				)}
			</Show>
		</Layout>
	);
}
