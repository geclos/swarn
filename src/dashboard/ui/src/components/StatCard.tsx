import type { JSX } from "solid-js";

type StatTone = "neutral" | "info" | "success" | "warning" | "danger";

interface StatCardProps {
	label: string;
	value: string | number;
	helper?: string;
	tone?: StatTone;
}

export function StatCard(props: StatCardProps): JSX.Element {
	return (
		<article class={`stat-card stat-${props.tone ?? "neutral"}`}>
			<p class="stat-label">{props.label}</p>
			<p class="stat-value">{props.value}</p>
			{props.helper ? <p class="stat-helper">{props.helper}</p> : null}
		</article>
	);
}
