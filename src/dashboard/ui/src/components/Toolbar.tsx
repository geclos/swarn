import type { JSX, ParentProps } from "solid-js";

interface ToolbarProps extends ParentProps {
	title: string;
	description?: string;
	actions?: JSX.Element;
}

export function Toolbar(props: ToolbarProps): JSX.Element {
	return (
		<section class="toolbar">
			<div>
				<h2>{props.title}</h2>
				{props.description ? <p>{props.description}</p> : null}
			</div>
			<div class="toolbar-actions">{props.actions}</div>
			{props.children}
		</section>
	);
}
