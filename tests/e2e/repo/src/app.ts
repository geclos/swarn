export function greet(name: string, excited?: boolean): string {
	const message = `Hello, ${name}`;
	return excited ? `${message.toUpperCase()}!!!` : message;
}
