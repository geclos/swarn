import {
	formatCostUsd,
	formatDateTime,
	formatDurationBetween,
	formatTokenCount,
} from "../lib/format.js";
import type { SwarmDetailDto } from "../lib/types.js";
import { StatCard } from "./StatCard.js";
import { StatusChip } from "./StatusChip.js";

interface SwarmHeaderProps {
	swarm: SwarmDetailDto;
}

export function SwarmHeader(props: SwarmHeaderProps) {
	const totalTokens = () => props.swarm.tokensIn + props.swarm.tokensOut;
	const duration = () =>
		formatDurationBetween(props.swarm.createdAt, props.swarm.updatedAt);

	return (
		<>
			<section class="surface swarm-card">
				<div class="swarm-card-header">
					<h2 class="mono-value">Swarm #{props.swarm.id}</h2>
					<StatusChip status={props.swarm.status} />
				</div>
				<p class="mono-value">{props.swarm.workingDir}</p>
			</section>

			<div class="stats-grid">
				<StatCard label="Swarm ID" value={props.swarm.id} />
				<StatCard
					label="Iteration"
					value={`${props.swarm.iteration}/${props.swarm.maxIterations}`}
				/>
				<StatCard
					label="Total tokens"
					value={formatTokenCount(totalTokens())}
					helper={`In ${formatTokenCount(props.swarm.tokensIn)} / Out ${formatTokenCount(props.swarm.tokensOut)}`}
				/>
				<StatCard label="Total cost" value={formatCostUsd(props.swarm.cost)} />
				<StatCard
					label="Created"
					value={formatDateTime(props.swarm.createdAt)}
				/>
				<StatCard
					label="Updated"
					value={formatDateTime(props.swarm.updatedAt)}
				/>
				<StatCard
					label="Duration"
					value={duration()}
					helper="Computed from timestamps"
				/>
				<StatCard
					label="Working directory"
					value={props.swarm.workingDir}
					helper={
						props.swarm.branch
							? `Branch ${props.swarm.branch}`
							: "No branch recorded"
					}
				/>
			</div>
		</>
	);
}
