import { greet } from "./app.js";

const args = process.argv.slice(2);
let positionalName: string | undefined;
let flagName: string | undefined;
let excited = false;

for (let index = 0; index < args.length; index += 1) {
	const arg = args[index];
	if (arg === "--name") {
		const nextArg = args[index + 1];
		if (nextArg !== undefined) {
			flagName = nextArg;
			index += 1;
		}
		continue;
	}

	if (arg === "--excited") {
		excited = true;
		continue;
	}

	if (!arg.startsWith("--") && positionalName === undefined) {
		positionalName = arg;
	}
}

const name = flagName ?? positionalName ?? "world";
console.log(greet(name, excited));
