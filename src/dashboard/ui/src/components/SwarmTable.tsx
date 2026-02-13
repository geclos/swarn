import { A } from "@solidjs/router";
import { For, Show } from "solid-js";
import {
	formatCostUsd,
	formatDateTime,
	formatTokenCount,
} from "../lib/format.js";
import type { SwarmListItemDto } from "../lib/types.js";
import { ProgressBar } from "./ProgressBar.js";
import { StatusChip } from "./StatusChip.js";

interface SwarmTableProps {
	swarms: SwarmListItemDto[];
}

export function SwarmTable(props: SwarmTableProps) {
	return (
		<>
			<div class="surface table-surface desktop-only">
				<table class="swarm-table">
					<thead>
						<tr>
							<th>ID</th>
							<th>Status</th>
							<th>Tasks</th>
							<th>Iteration</th>
							<th>Tokens in/out</th>
							<th>Cost</th>
							<th>Created</th>
						</tr>
					</thead>
					<tbody>
						<For each={props.swarms}>
							{(swarm) => (
								<tr class="clickable-swarm-row">
									<td class="mono-value">
										<A class="swarm-row-link" href={`/swarm/${swarm.id}`}>
											#{swarm.id}
										</A>
									</td>
									<td>
										<A class="swarm-row-link" href={`/swarm/${swarm.id}`}>
											<div class="status-stack">
												<StatusChip status={swarm.status} />
												<Show when={swarm.status === "running"}>
													<span class="running-badge">
														<span class="running-dot" />
														Live
													</span>
												</Show>
											</div>
										</A>
									</td>
									<td>
										<A class="swarm-row-link" href={`/swarm/${swarm.id}`}>
											<div class="task-progress-cell">
												<span>
													{swarm.tasksCompleted}/{swarm.tasksTotal}
												</span>
												<ProgressBar
													completed={swarm.tasksCompleted}
													total={swarm.tasksTotal}
												/>
											</div>
										</A>
									</td>
									<td>
										<A class="swarm-row-link" href={`/swarm/${swarm.id}`}>
											{swarm.iteration}/{swarm.maxIterations}
										</A>
									</td>
									<td class="mono-value">
										<A class="swarm-row-link" href={`/swarm/${swarm.id}`}>
											{formatTokenCount(swarm.tokensIn)} /{" "}
											{formatTokenCount(swarm.tokensOut)}
										</A>
									</td>
									<td>
										<A class="swarm-row-link" href={`/swarm/${swarm.id}`}>
											{formatCostUsd(swarm.cost)}
										</A>
									</td>
									<td>
										<A class="swarm-row-link" href={`/swarm/${swarm.id}`}>
											{formatDateTime(swarm.createdAt)}
										</A>
									</td>
								</tr>
							)}
						</For>
					</tbody>
				</table>
			</div>

			<div class="mobile-stack">
				<For each={props.swarms}>
					{(swarm) => (
						<A
							class="surface swarm-card swarm-card-link"
							href={`/swarm/${swarm.id}`}
						>
							<div class="swarm-card-header">
								<h3 class="mono-value">Swarm #{swarm.id}</h3>
								<div class="status-stack">
									<StatusChip status={swarm.status} />
									<Show when={swarm.status === "running"}>
										<span class="running-badge">
											<span class="running-dot" />
											Live
										</span>
									</Show>
								</div>
							</div>
							<div class="swarm-card-metrics">
								<span>
									Tasks {swarm.tasksCompleted}/{swarm.tasksTotal}
								</span>
								<ProgressBar
									completed={swarm.tasksCompleted}
									total={swarm.tasksTotal}
								/>
								<span>
									Iteration {swarm.iteration}/{swarm.maxIterations}
								</span>
								<span class="mono-value">
									Tokens {formatTokenCount(swarm.tokensIn)} /{" "}
									{formatTokenCount(swarm.tokensOut)}
								</span>
								<span>Cost {formatCostUsd(swarm.cost)}</span>
								<span>Created {formatDateTime(swarm.createdAt)}</span>
							</div>
						</A>
					)}
				</For>
			</div>
		</>
	);
}
