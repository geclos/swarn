import type { JSX } from "solid-js";

type StatusValue =
	| "running"
	| "completed"
	| "failed"
	| "stopped"
	| "pending"
	| "in_progress"
	| "blocked";

interface StatusChipProps {
	status: StatusValue;
}

export function StatusChip(props: StatusChipProps): JSX.Element {
	const statusClass = `status-${props.status.replaceAll("_", "-")}`;
	const label = props.status.replaceAll("_", " ");
	const tooltip = `Status: ${label}`;

	return (
		<span class={`status-chip ${statusClass}`} title={tooltip}>
			{label}
		</span>
	);
}
