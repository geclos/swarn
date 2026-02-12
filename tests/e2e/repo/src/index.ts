import { greet } from "./app.js";

const args = process.argv.slice(2);
let name = "world";
let excited = false;

for (let index = 0; index < args.length; index += 1) {
	const arg = args[index];

	if (arg === "--excited") {
		excited = true;
		continue;
	}

	if (arg === "--name") {
		const value = args[index + 1];
		if (value && !value.startsWith("--")) {
			name = value;
			index += 1;
		}
		continue;
	}

	if (arg.startsWith("--name=")) {
		const value = arg.slice("--name=".length);
		if (value) {
			name = value;
		}
	}
}

console.log(greet(name, excited));
