import { createMemo, createResource, Show } from "solid-js";
import {
	EmptyState,
	ErrorState,
	Layout,
	LoadingState,
} from "../components/Layout.js";
import { StatCard } from "../components/StatCard.js";
import { StatusChip } from "../components/StatusChip.js";
import { SwarmTable } from "../components/SwarmTable.js";
import { Toolbar } from "../components/Toolbar.js";
import { listSwarms } from "../lib/api.js";
import { createPolling, shouldPollSwarmList } from "../lib/polling.js";

export default function SwarmListRoute() {
	const [swarms] = createResource(() => listSwarms());

	createPolling({
		enabled: () => shouldPollSwarmList(swarms() ?? []),
		refresh: async () => {
			await swarms.refetch();
		},
	});

	const sortedSwarms = createMemo(() => {
		const items = [...(swarms() ?? [])];
		items.sort((left, right) => {
			const leftTime = new Date(left.createdAt).getTime();
			const rightTime = new Date(right.createdAt).getTime();

			if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
				return right.id - left.id;
			}

			return rightTime - leftTime;
		});

		return items;
	});

	const totalTasks = createMemo(() =>
		sortedSwarms().reduce((count, swarm) => count + swarm.tasksTotal, 0),
	);
	const activeCount = createMemo(
		() => sortedSwarms().filter((swarm) => swarm.status === "running").length,
	);
	const completedTasks = createMemo(() =>
		sortedSwarms().reduce((count, swarm) => count + swarm.tasksCompleted, 0),
	);
	const failedTasks = createMemo(() =>
		sortedSwarms().reduce((count, swarm) => count + swarm.tasksFailed, 0),
	);

	return (
		<Layout
			title="Swarm Control"
			subtitle="Track active swarms, their progress, and iteration health."
		>
			<div class="stats-grid">
				<StatCard label="Active swarms" value={activeCount()} tone="info" />
				<StatCard label="Total tasks" value={totalTasks()} />
				<StatCard
					label="Completed tasks"
					value={completedTasks()}
					tone="success"
				/>
				<StatCard label="Failed tasks" value={failedTasks()} tone="danger" />
			</div>

			<Toolbar
				title="Recent swarms"
				description="The newest orchestration runs across your worktrees."
			/>

			<section class="surface status-legend" aria-label="Status legend">
				<p class="status-legend-title">Status legend</p>
				<div class="status-legend-grid">
					<div class="status-legend-item">
						<StatusChip status="running" />
						<span>Swarm is actively running.</span>
					</div>
					<div class="status-legend-item">
						<StatusChip status="completed" />
						<span>Execution finished successfully.</span>
					</div>
					<div class="status-legend-item">
						<StatusChip status="failed" />
						<span>Execution encountered a failure.</span>
					</div>
					<div class="status-legend-item">
						<StatusChip status="stopped" />
						<span>Execution was manually stopped.</span>
					</div>
					<div class="status-legend-item">
						<StatusChip status="in_progress" />
						<span>Task work is currently in progress.</span>
					</div>
					<div class="status-legend-item">
						<StatusChip status="pending" />
						<span>Task is waiting to start.</span>
					</div>
					<div class="status-legend-item">
						<StatusChip status="blocked" />
						<span>Task is blocked by unmet dependencies.</span>
					</div>
				</div>
			</section>

			<Show when={swarms.loading}>
				<LoadingState />
			</Show>

			<Show when={swarms.error}>
				<ErrorState
					title="Could not load swarms"
					message="Check that the dashboard API server is running and reachable."
					action={
						<button type="button" onClick={() => swarms.refetch()}>
							Retry
						</button>
					}
				/>
			</Show>

			<Show
				when={!swarms.loading && !swarms.error && (swarms()?.length ?? 0) === 0}
			>
				<EmptyState
					title="No swarms yet"
					message="Start a swarm run from the CLI to populate this dashboard."
				/>
			</Show>

			<Show when={sortedSwarms().length > 0}>
				<SwarmTable swarms={sortedSwarms()} />
			</Show>
		</Layout>
	);
}
