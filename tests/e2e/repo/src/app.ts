export function greet(name: string, excited?: boolean): string {
	const greeting = `Hello, ${name}`;

	if (!excited) {
		return greeting;
	}

	return `${greeting.toUpperCase()}!!!`;
}
