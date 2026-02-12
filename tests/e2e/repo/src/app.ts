export function greet(name: string, excited = false): string {
	const greeting = `Hello, ${name}`;
	if (!excited) {
		return greeting;
	}

	return `${greeting.toUpperCase()}!!!`;
}
