import { Effect, Logger, LogLevel } from "effect";

export const loggerLayer = Logger.replace(
	Logger.defaultLogger,
	Logger.make(({ date, logLevel, message }) => {
		const timestamp = date.toLocaleTimeString("en-US", { hour12: false });
		const prefix = logLevel.label.padStart(4, " ");

		let color = "\x1b[0m";
		switch (logLevel._tag) {
			case "Debug":
				color = "\x1b[90m";
				break;
			case "Info":
				color = "\x1b[36m";
				break;
			case "Warning":
				color = "\x01b[33m";
				break;
			case "Error":
				color = "\x1b[31m";
				break;
		}

		const msg = Array.isArray(message)
			? message
					.map((m) => (typeof m === "object" ? JSON.stringify(m) : String(m)))
					.join(" ")
			: String(message);

		globalThis.console.log(`${color}[${timestamp}] ${prefix}\x1b[0m ${msg}`);
	}),
);

export const withLogLevel = (verbose: boolean) =>
	verbose
		? Logger.minimumLogLevel(LogLevel.Debug)
		: Logger.minimumLogLevel(LogLevel.Info);

export function logInfo(message: string): Effect.Effect<void> {
	return Effect.log(message);
}

export function logDebug(message: string): Effect.Effect<void> {
	return Effect.logDebug(message);
}

export function logWarning(message: string): Effect.Effect<void> {
	return Effect.logWarning(message);
}

export function logError(message: string): Effect.Effect<void> {
	return Effect.logError(message);
}

export function logWorker(
	sessionId: string,
	message: string,
): Effect.Effect<void> {
	return Effect.log(`[W:${sessionId.slice(0, 6)}] ${message}`);
}

export function logJudge(message: string): Effect.Effect<void> {
	return Effect.log(`[JUDGE] ${message}`);
}

export function logIteration(n: number, max: number): Effect.Effect<void> {
	return Effect.sync(() => {
		globalThis.console.log(`\n\x1b[1m--- Iteration ${n}/${max} ---\x1b[0m\n`);
	});
}

export function logSuccess(message: string): Effect.Effect<void> {
	return Effect.sync(() => {
		const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
		globalThis.console.log(`\x1b[32m[${timestamp}]  OK \x1b[0m ${message}`);
	});
}
