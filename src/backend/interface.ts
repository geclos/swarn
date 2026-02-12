import type { Effect } from "effect";
import type { PromptError, SessionError } from "../models/errors.js";

export interface SessionOpts {
	title: string;
	mode: "plan" | "build";
	workingDir: string;
	model?: { providerID: string; modelID: string };
	thinking?: "high" | "low";
}

export interface PromptOpts {
	agent?: string;
	format?: JsonSchemaFormat;
}

export interface JsonSchemaFormat {
	type: "json_schema";
	schema: object;
}

export interface AgentResponse {
	text: string;
	parts: unknown[];
	tokens: { input: number; output: number };
	cost: number;
}

export interface AgentBackend {
	createSession(opts: SessionOpts): Effect.Effect<string, SessionError>;
	destroySession(sessionId: string): Effect.Effect<void, never>;
	prompt(
		sessionId: string,
		message: string,
		opts?: PromptOpts,
	): Effect.Effect<AgentResponse, PromptError>;
	getStatus(sessionId: string): Effect.Effect<"idle" | "busy" | "error", never>;
	healthCheck(): Effect.Effect<boolean, never>;
}
