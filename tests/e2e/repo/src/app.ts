interface GreetOptions {
	excited?: boolean;
}

export function greet(name: string, options: GreetOptions = {}): string {
	const greeting = `Hello, ${name}`;

	if (!options.excited) {
		return greeting;
	}

	return `${greeting.toUpperCase()}!!!`;
}
