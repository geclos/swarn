import {
	createOpencodeClient,
	type OpencodeClient,
	type PermissionConfig,
	type SessionPromptResponses,
	type TextPart,
} from "@opencode-ai/sdk/v2";
import { Effect, Either } from "effect";
import { PromptError, SessionError } from "../models/errors.js";
import { logDebug } from "../output/logger.js";
import type {
	AgentBackend,
	AgentResponse,
	PromptOpts,
	SessionOpts,
} from "./interface.js";

interface PromptParams {
	sessionID: string;
	directory?: string;
	messageID?: string;
	model?: {
		providerID: string;
		modelID: string;
	};
	agent?: string;
	noReply?: boolean;
	tools?: {
		[key: string]: boolean;
	};
	system?: string;
	variant?: string;
	parts: Array<{ type: "text"; text: string }>;
	format?: {
		type: "json_schema";
		schema: object;
	};
}

export class OpenCodeBackend implements AgentBackend {
	private client: OpencodeClient;
	private sessionDirs = new Map<string, string>();
	private sessionModels = new Map<
		string,
		{ providerID: string; modelID: string }
	>();

	constructor(serverUrl: string) {
		this.client = createOpencodeClient({ baseUrl: serverUrl });
	}

	allowAllPermissions(): Effect.Effect<void, never> {
		return Effect.gen(this, function* () {
			const result = yield* Effect.either(
				Effect.tryPromise(() =>
					this.client.global.config.update({
						config: {
							permission: {
								"*": "allow",
								external_directory: "allow",
							} as PermissionConfig,
						},
					}),
				),
			);

			if (Either.isLeft(result)) {
				yield* logDebug(`Failed to set permissions: ${result.left}`);
			}
		});
	}

	createSession(opts: SessionOpts): Effect.Effect<string, SessionError> {
		return Effect.gen(this, function* () {
			const result = yield* Effect.either(
				Effect.tryPromise(() =>
					this.client.session.create(
						{
							directory: opts.workingDir,
							title: opts.title,
						},
						{
							headers: { "x-opencode-directory": opts.workingDir },
						},
					),
				),
			);

			if (Either.isLeft(result)) {
				return yield* new SessionError({
					message: `Failed to create session: ${result.left}`,
				});
			}

			const resp = result.right;
			if (!resp.data) {
				return yield* new SessionError({
					message: `Failed to create session: ${JSON.stringify(resp.error)}`,
				});
			}

			this.sessionDirs.set(resp.data.id, opts.workingDir);
			if (opts.model) {
				this.sessionModels.set(resp.data.id, opts.model);
			}
			yield* logDebug(`Created session ${resp.data.id} for "${opts.title}"`);
			return resp.data.id;
		});
	}

	destroySession(sessionId: string): Effect.Effect<void, never> {
		return Effect.gen(this, function* () {
			const directory = this.sessionDirs.get(sessionId);

			yield* Effect.either(
				Effect.tryPromise(() =>
					this.client.session.delete(
						{ sessionID: sessionId, directory },
						directory
							? { headers: { "x-opencode-directory": directory } }
							: undefined,
					),
				),
			);

			this.sessionDirs.delete(sessionId);
			this.sessionModels.delete(sessionId);
			yield* logDebug(`Destroyed session ${sessionId}`);
		});
	}

	prompt(
		sessionId: string,
		message: string,
		opts?: PromptOpts,
	): Effect.Effect<AgentResponse, PromptError> {
		return Effect.gen(this, function* () {
			const directory = this.sessionDirs.get(sessionId);
			const model = this.sessionModels.get(sessionId);

			const runPrompt = async (useModel: boolean) => {
				const params: PromptParams = {
					sessionID: sessionId,
					directory,
					parts: [{ type: "text", text: message }],
					noReply: false,
				};

				if (opts?.agent) {
					params.agent = opts.agent;
				}

				if (useModel && model) {
					params.model = model;
				}

				if (opts?.format) {
					params.format = opts.format;
				}

				return this.client.session.prompt(params, {
					headers: directory
						? { "x-opencode-directory": directory }
						: undefined,
				});
			};

			const t0 = Date.now();
			yield* logDebug(
				`Sending prompt to session ${sessionId} (${message.length} chars)...`,
			);

			const result = yield* Effect.either(
				Effect.tryPromise(() => runPrompt(true)),
			);

			if (Either.isLeft(result)) {
				return yield* new PromptError({
					message: `Prompt failed: ${result.left}`,
					sessionId,
				});
			}

			let promptResp = result.right;
			yield* logDebug(
				`Prompt response received in ${((Date.now() - t0) / 1000).toFixed(1)}s — status ${promptResp.response.status} content-type ${promptResp.response.headers.get("content-type") ?? "none"}`,
			);

			if (!promptResp.data) {
				return yield* new PromptError({
					message: `Prompt failed: ${JSON.stringify(promptResp.error)}`,
					sessionId,
				});
			}

			const promptData = promptResp.data as SessionPromptResponses[200];
			let info = promptData.info;
			let parts = promptData.parts ?? [];
			let textParts = parts
				.filter((p): p is TextPart => p.type === "text")
				.map((p) => (p as TextPart).text);

			if (textParts.length === 0 && model) {
				yield* logDebug(
					"Prompt returned no text parts, retrying without explicit model...",
				);

				const retryResult = yield* Effect.either(
					Effect.tryPromise(() => runPrompt(false)),
				);

				if (Either.isLeft(retryResult)) {
					return yield* new PromptError({
						message: `Prompt retry failed: ${retryResult.left}`,
						sessionId,
					});
				}

				promptResp = retryResult.right;
				if (!promptResp.data) {
					return yield* new PromptError({
						message: `Prompt retry failed: ${JSON.stringify(promptResp.error)}`,
						sessionId,
					});
				}

				const retryData = promptResp.data as SessionPromptResponses[200];
				info = retryData.info;
				parts = retryData.parts ?? [];
				textParts = parts
					.filter((p): p is TextPart => p.type === "text")
					.map((p) => (p as TextPart).text);
			}

			if (textParts.length === 0) {
				const respData = promptResp.data;
				const partTypes = parts.map((p) => p.type).join(", ");
				const infoKeys =
					info && typeof info === "object"
						? Object.keys(info).join(", ")
						: "none";
				const dataKeys =
					respData && typeof respData === "object"
						? Object.keys(respData as object).join(", ")
						: "none";
				const dataType = respData === null ? "null" : typeof respData;
				const dataPreview =
					typeof respData === "string"
						? (respData as string).slice(0, 200)
						: "";
				yield* logDebug(
					`Prompt response had no text parts. Part types: ${partTypes || "none"}`,
				);
				yield* logDebug(
					`Prompt data keys: ${dataKeys || "none"} info keys: ${infoKeys || "none"}`,
				);
				yield* logDebug(
					`Prompt data type: ${dataType}${dataPreview ? ` preview=${dataPreview}` : ""}`,
				);
			}

			if (info?.error) {
				return yield* new PromptError({
					message: `Agent error: ${JSON.stringify(info.error)}`,
					sessionId,
				});
			}

			return {
				text: textParts.join("\n"),
				parts,
				tokens: {
					input: info?.tokens?.input ?? 0,
					output: info?.tokens?.output ?? 0,
				},
				cost: info?.cost ?? 0,
			};
		});
	}

	getStatus(
		sessionId: string,
	): Effect.Effect<"idle" | "busy" | "error", never> {
		return Effect.gen(this, function* () {
			const result = yield* Effect.either(
				Effect.tryPromise(() => this.client.session.status({})),
			);

			if (Either.isLeft(result)) {
				return "error";
			}

			const resp = result.right;
			if (!resp.data) return "error";
			const status = resp.data[sessionId];
			if (!status) return "idle";
			return status.type === "busy" ? "busy" : "idle";
		});
	}

	healthCheck(): Effect.Effect<boolean, never> {
		return Effect.gen(this, function* () {
			const result = yield* Effect.either(
				Effect.tryPromise(() => this.client.session.list({})),
			);

			if (Either.isLeft(result)) {
				return false;
			}

			const resp = result.right;
			return resp.data !== undefined;
		});
	}
}
