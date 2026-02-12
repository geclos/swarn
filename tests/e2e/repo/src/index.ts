import { greet } from "./app.js";

const args = process.argv.slice(2);
let name = "world";
let excited = false;

for (let i = 0; i < args.length; i++) {
	const arg = args[i];
	if (arg === "--name") {
		const next = args[i + 1];
		if (next !== undefined) {
			name = next;
			i++;
		}
		continue;
	}
	if (arg === "--excited") {
		excited = true;
	}
}

console.log(greet(name, excited));
