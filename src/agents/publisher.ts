import { Data, Effect, Either } from "effect";
import type { AgentBackend } from "../backend/interface.js";
import type { PromptError, SessionError } from "../models/errors.js";
import { logError, logInfo, logSuccess } from "../output/logger.js";

export class PublishError extends Data.TaggedError("PublishError")<{
	message: string;
}> {}

export interface PublishParams {
	workingDir: string;
}

export interface PublishResult {
	prUrl: string;
	commitHash: string;
}

const PUBLISHER_SCHEMA = {
	type: "object",
	properties: {
		success: {
			type: "boolean",
			description: "Whether the PR was created successfully",
		},
		prUrl: {
			type: "string",
			description: "URL of the created pull request (empty if failed)",
		},
		commitHash: {
			type: "string",
			description: "Git commit hash of the pushed changes (empty if failed)",
		},
		summary: {
			type: "string",
			description: "Brief summary of what was done or error message if failed",
		},
	},
	required: ["success", "prUrl", "commitHash", "summary"],
};

function publisherPrompt(): string {
	return `You are a publishing agent. Your job is to commit all changes, push them to remote, and create a pull request. Use the same title/description in commit and PR.

## Instructions

1. Thoroughly analyze the git diff to understand what was done.
2. Commit and push the branch to the remote repository
3. Create a draft pull request using the GitHub CLI (gh pr create)

# Tips

- Use the commit-work skill if available to write the commit message.

## Output Format

Output a JSON object with:
- success: Whether the PR was created successfully
- prUrl: URL of the created pull request (empty if failed)
- commitHash: Git commit hash of the pushed changes (empty if failed)
- summary: Brief summary of what was done or error message if failed`;
}

export type PublisherError = SessionError | PromptError | PublishError;

export function executePublisher(
	backend: AgentBackend,
	params: PublishParams,
	model?: { providerID: string; modelID: string } | null,
): Effect.Effect<PublishResult, PublisherError> {
	return Effect.gen(function* () {
		yield* logInfo("Starting publisher agent to push changes and create PR...");

		const sessionIdResult = yield* Effect.either(
			backend.createSession({
				title: "swarn-publisher",
				mode: "build",
				workingDir: params.workingDir,
				model: model ?? undefined,
			}),
		);

		if (Either.isLeft(sessionIdResult)) {
			const error = sessionIdResult.left.message;
			yield* logError(`Publisher failed to create session: ${error}`);
			return yield* Effect.fail(
				new PublishError({
					message: `Failed to create session: ${error}`,
				}),
			);
		}

		const sessionId = sessionIdResult.right;

		try {
			const prompt = publisherPrompt();
			yield* logInfo("Publisher agent analyzing changes and creating PR...");

			const responseResult = yield* Effect.either(
				backend.prompt(sessionId, prompt, {
					format: { type: "json_schema", schema: PUBLISHER_SCHEMA },
				}),
			);

			if (Either.isLeft(responseResult)) {
				const error = responseResult.left.message;
				yield* logError(`Publisher agent failed: ${error}`);
				return yield* Effect.fail(
					new PublishError({
						message: `Publisher agent failed: ${error}`,
					}),
				);
			}

			const response = responseResult.right;
			const result = parsePublisherOutput(response.text);
			if (!result.success) {
				yield* logError(`Publisher failed: ${result.summary}`);
				return yield* Effect.fail(
					new PublishError({
						message: result.summary,
					}),
				);
			}

			yield* logSuccess(`Publisher complete: ${result.prUrl}`);
			return {
				prUrl: result.prUrl,
				commitHash: result.commitHash,
			};
		} finally {
			yield* backend.destroySession(sessionId);
		}
	});
}

interface ParsedOutput {
	success: boolean;
	prUrl: string;
	commitHash: string;
	summary: string;
}

function parsePublisherOutput(text: string): ParsedOutput {
	// Try to parse as JSON first (structured output)
	try {
		const parsed = JSON.parse(text);
		if (
			parsed &&
			typeof parsed === "object" &&
			typeof parsed.success === "boolean"
		) {
			return {
				success: parsed.success,
				prUrl: parsed.prUrl ?? "",
				commitHash: parsed.commitHash ?? "",
				summary: parsed.summary ?? "",
			};
		}
	} catch {
		// Fall back to parsing summary block
	}

	// Fallback: try to extract from summary code block
	const summaryMatch = text.match(/```summary\n([\s\S]*?)```/);
	if (!summaryMatch?.[1]) {
		return {
			success: false,
			prUrl: "",
			commitHash: "",
			summary: "No summary block found in publisher response",
		};
	}

	const block = summaryMatch[1];
	const successMatch = block.match(/Success:\s*(true|yes|1)/i);
	const prUrlMatch = block.match(/PR URL:\s*(.+)/i);
	const commitMatch = block.match(/Commit:\s*(.+)/i);
	const summaryLine = block.match(/Summary:\s*(.+)/is);

	return {
		success: !!successMatch,
		prUrl: prUrlMatch?.[1]?.trim() ?? "",
		commitHash: commitMatch?.[1]?.trim() ?? "",
		summary: summaryLine?.[1]?.trim() ?? block.trim(),
	};
}
