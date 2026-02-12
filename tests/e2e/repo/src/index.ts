import { greet } from "./app.js";

const args = process.argv.slice(2);
let name: string | undefined;
let nameFlagPresent = false;
let excited = false;

for (let i = 0; i < args.length; i += 1) {
	const arg = args[i];

	if (arg === "--excited") {
		excited = true;
		continue;
	}

	if (arg === "--name") {
		nameFlagPresent = true;
		name = args[i + 1];
		i += 1;
		continue;
	}

	if (arg.startsWith("--name=")) {
		nameFlagPresent = true;
		name = arg.slice("--name=".length);
	}
}

if (!name && !nameFlagPresent) {
	const positionalName = args.find((arg) => !arg.startsWith("--"));
	name = positionalName ?? "world";
}

name ??= "world";

console.log(greet(name, { excited }));
