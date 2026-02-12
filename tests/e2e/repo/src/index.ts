import { greet } from "./app.js";

const args = process.argv.slice(2);
let name: string | undefined;
let excited = false;
const positionals: string[] = [];

for (let i = 0; i < args.length; i += 1) {
	const arg = args[i];
	if (arg === "--name") {
		const value = args[i + 1];
		if (value) {
			name = value;
			i += 1;
		}
		continue;
	}
	if (arg === "--excited") {
		excited = true;
		continue;
	}
	positionals.push(arg);
}

const resolvedName = name ?? positionals[0] ?? "world";
console.log(greet(resolvedName, excited));
