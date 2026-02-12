export function greet(name: string, excited = false): string {
	const greeting = `Hello, ${name}`;
	if (excited) {
		return `${greeting.toUpperCase()}!!!`;
	}
	return greeting;
}
