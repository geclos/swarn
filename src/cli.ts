import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Effect } from "effect";
import { defaults } from "./config.js";
import { ValidationError } from "./models/errors.js";
import type { SwarnConfig } from "./models/swarn.js";

export function parseArgs(args: string[]): SwarnConfig {
	const config: SwarnConfig = { ...defaults };

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (!arg) continue;
		const next = args[i + 1];

		switch (arg) {
			case "--plan":
			case "-p":
				config.planSource = next ?? null;
				i++;
				break;
			case "--workers":
			case "-w":
				config.maxWorkers = parseInt(next ?? "4", 10);
				i++;
				break;
			case "--iterations":
			case "-i":
				config.maxIterations = parseInt(next ?? "3", 10);
				i++;
				break;
			case "--model":
			case "-m": {
				if (next) {
					const [providerID, ...rest] = next.split("/");
					const modelID = rest.join("/");
					if (providerID && modelID) {
						config.model = { providerID, modelID };
					}
				}
				i++;
				break;
			}
			case "--dir":
			case "-d":
				config.workingDir = resolve(next ?? process.cwd());
				i++;
				break;
			case "--server":
			case "-s":
				config.serverUrl = next ?? config.serverUrl;
				i++;
				break;
			case "--verbose":
			case "-v":
				config.verbose = true;
				break;
			case "--help":
			case "-h":
				printHelp();
				process.exit(0);
		}
	}

	return config;
}

export function readPlan(
	config: SwarnConfig,
): Effect.Effect<string, ValidationError> {
	return Effect.gen(function* () {
		if (config.planSource) {
			// Could be a file path or inline text
			if (
				config.planSource.startsWith("[") ||
				config.planSource.startsWith("{")
			) {
				return config.planSource;
			}
			return yield* Effect.try({
				try: () => readFileSync(resolve(config.planSource!), "utf-8"),
				catch: (error) =>
					new ValidationError({
						message: `Failed to read plan file: ${error}`,
					}),
			});
		}

		// Read from stdin
		return yield* readStdin();
	});
}

function readStdin(): Effect.Effect<string, ValidationError> {
	return Effect.tryPromise({
		try: async () => {
			// Check if stdin is a TTY (no piped input)
			if (process.stdin.isTTY) {
				throw new Error(
					"No plan provided. Use --plan <file>, pipe via stdin, or pass inline text.",
				);
			}

			const chunks: Buffer[] = [];
			for await (const chunk of process.stdin) {
				chunks.push(chunk as Buffer);
			}
			return Buffer.concat(chunks).toString("utf-8");
		},
		catch: (error) =>
			new ValidationError({
				message: error instanceof Error ? error.message : String(error),
			}),
	});
}

function printHelp(): void {
	console.log(`
\x1b[1mswarn\x1b[0m — Execute plans with parallel worker agents

\x1b[1mUSAGE\x1b[0m
  swarn --plan <file>
  echo 'Rewrite auth to use JWT' | swarn
  swarn --plan request.md --workers 6 --iterations 3

\x1b[1mOPTIONS\x1b[0m
  -p, --plan <path|text>   Plan file path or inline text (default: stdin)
  -w, --workers <n>        Max parallel workers (default: 4)
  -i, --iterations <n>     Max judge iterations (default: 3)
  -m, --model <p/m>        Model as provider/model (overrides defaults)
  -d, --dir <path>         Working directory (default: cwd)
  -s, --server <url>       OpenCode server URL (default: http://localhost:4096)
  -v, --verbose            Verbose logging
  -h, --help               Show this help

\x1b[1mPLAN FORMAT\x1b[0m
  Plans are freeform markdown or text describing what you want done.
  The planner agent explores your codebase and converts your request
  into a detailed execution plan with task dependencies.

  Example:
    Rewrite the auth system to use JWT instead of sessions.
    The login and signup endpoints need to return tokens.
    Add a middleware that validates tokens on protected routes.
`);
}
