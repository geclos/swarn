import { greet } from "./app.js";

const args = process.argv.slice(2);
let nameArg: string | undefined;
let excited = false;

for (let i = 0; i < args.length; i += 1) {
	const arg = args[i];

	if (arg === "--excited") {
		excited = true;
		continue;
	}

	if (arg === "--name") {
		const next = args[i + 1];
		if (next === undefined || next.startsWith("--")) {
			nameArg = "";
		} else {
			nameArg = next;
			i += 1;
		}
		continue;
	}

	if (arg.startsWith("--name=")) {
		nameArg = arg.slice("--name=".length);
	}
}

const name = nameArg?.trim() ? nameArg : "world";
console.log(greet(name, excited));
