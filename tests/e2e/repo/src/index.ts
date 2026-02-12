import { greet } from "./app.js";

let name = "world";
let excited = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 1) {
	const arg = args[i];
	if (arg === "--name") {
		const next = args[i + 1];
		if (next !== undefined && !next.startsWith("--")) {
			name = next;
			i += 1;
		}
		continue;
	}
	if (arg === "--excited") {
		excited = true;
	}
}

let message = greet(name);
if (excited) {
	message = `${message.toUpperCase()}!!!`;
}

console.log(message);
