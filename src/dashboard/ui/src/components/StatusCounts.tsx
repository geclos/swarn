import type { StatusCounts as StatusCountsModel } from "../lib/types.js";
import { StatCard } from "./StatCard.js";

interface StatusCountsProps {
	counts: StatusCountsModel;
}

export function StatusCounts(props: StatusCountsProps) {
	return (
		<div class="stats-grid">
			<StatCard
				label="Pending"
				value={props.counts.pending}
				helper={`${props.counts.total} total`}
				tone="warning"
			/>
			<StatCard
				label="In progress"
				value={props.counts.inProgress}
				helper={`${props.counts.total} total`}
				tone="info"
			/>
			<StatCard
				label="Blocked"
				value={props.counts.blocked}
				helper={`${props.counts.total} total`}
				tone="warning"
			/>
			<StatCard
				label="Completed"
				value={props.counts.completed}
				helper={`${props.counts.total} total`}
				tone="success"
			/>
			<StatCard
				label="Failed"
				value={props.counts.failed}
				helper={`${props.counts.total} total`}
				tone="danger"
			/>
		</div>
	);
}
