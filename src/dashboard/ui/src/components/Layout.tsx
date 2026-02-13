import type { JSX, ParentProps } from "solid-js";

interface LayoutProps extends ParentProps {
	title: string;
	subtitle?: string;
	actions?: JSX.Element;
}

interface StateProps {
	title: string;
	message: string;
	action?: JSX.Element;
}

export function Layout(props: LayoutProps): JSX.Element {
	return (
		<div class="app-shell">
			<header class="app-header">
				<div>
					<p class="eyebrow">Swarn Dashboard</p>
					<h1>{props.title}</h1>
					{props.subtitle ? <p class="app-subtitle">{props.subtitle}</p> : null}
				</div>
				{props.actions ? (
					<div class="app-header-actions">{props.actions}</div>
				) : null}
			</header>
			<main class="page-content">{props.children}</main>
		</div>
	);
}

export function LoadingState(props: { message?: string }): JSX.Element {
	return (
		<output class="ui-state" aria-live="polite">
			<div class="loading-dot" />
			<h2>Loading dashboard data</h2>
			<p>{props.message ?? "Syncing swarms and tasks from the API."}</p>
		</output>
	);
}

export function EmptyState(props: StateProps): JSX.Element {
	return (
		<div class="ui-state">
			<h2>{props.title}</h2>
			<p>{props.message}</p>
			{props.action}
		</div>
	);
}

export function ErrorState(props: StateProps): JSX.Element {
	return (
		<div class="ui-state state-error" role="alert">
			<h2>{props.title}</h2>
			<p>{props.message}</p>
			{props.action}
		</div>
	);
}
