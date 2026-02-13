import { createMemo } from "solid-js";
import { formatProgressFromCounts } from "../lib/format.js";

interface ProgressBarProps {
	completed: number;
	total: number;
}

export function ProgressBar(props: ProgressBarProps) {
	const ratio = createMemo(() => {
		if (!Number.isFinite(props.completed) || !Number.isFinite(props.total)) {
			return 0;
		}

		if (props.total <= 0) {
			return 0;
		}

		return Math.max(0, Math.min(1, props.completed / props.total));
	});

	const percentLabel = createMemo(() =>
		formatProgressFromCounts(props.completed, props.total),
	);

	return (
		<div
			class="progress-inline"
			role="img"
			aria-label={`${props.completed} of ${props.total} tasks completed (${percentLabel()})`}
		>
			<div class="progress-track" aria-hidden="true">
				<div class="progress-fill" style={{ width: `${ratio() * 100}%` }} />
			</div>
			<span class="progress-text">{percentLabel()}</span>
		</div>
	);
}
