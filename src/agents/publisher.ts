import { Data, Effect, Either } from "effect";
import type { AgentBackend } from "../backend/interface.js";
import type { PromptError, SessionError } from "../models/errors.js";
import { logError, logInfo, logSuccess } from "../output/logger.js";

export class PublishError extends Data.TaggedError("PublishError")<{
	message: string;
}> {}

export interface PublishParams {
	workingDir: string;
	branch: string;
	prTitle: string;
	prBody: string;
	filesChanged: string[];
}

export interface PublishResult {
	prUrl: string;
	commitHash: string;
}

function publisherPrompt(params: PublishParams): string {
	return `You are a git automation assistant. Your task is to commit all changes, push the branch to origin, and create a draft pull request.

## Git Context

- Working directory: ${params.workingDir}
- Branch: ${params.branch}
- PR Title: ${params.prTitle}

## Files Changed

${params.filesChanged.map((f) => `- ${f}`).join("\n")}

## PR Body

${params.prBody}

## Your Tasks

1. **Stage all changes**: Run \`git add -A\` to stage all modified and new files
2. **Commit changes**: Create a commit with a descriptive message that summarizes the changes
3. **Push to origin**: Push the branch to origin with \`git push -u origin ${params.branch}\`
4. **Create draft PR**: Use the GitHub CLI to create a draft PR:
   \`gh pr create --draft --title "${params.prTitle}" --body "..." --head ${params.branch}\`

## Important Notes

- Make sure to include all changed files in the commit
- Use a clear, descriptive commit message that summarizes the work
- The PR should be created as a DRAFT
- If the gh CLI is not available or not authenticated, report the error
- End your response with a summary block (see format below)

## Output Format

When done, end your response with:
\`\`\`summary
Success: true/false
PR URL: <url or "failed">
Commit: <commit hash or "failed">
Summary: <brief description of what was done>
\`\`\``;
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
			return yield* new PublishError({
				message: `Failed to create session: ${error}`,
			});
		}

		const sessionId = sessionIdResult.right;

		try {
			const prompt = publisherPrompt(params);
			yield* logInfo("Publisher agent committing and pushing changes...");

			const responseResult = yield* Effect.either(
				backend.prompt(sessionId, prompt),
			);

			if (Either.isLeft(responseResult)) {
				const error = responseResult.left.message;
				yield* logError(`Publisher agent failed: ${error}`);
				return yield* new PublishError({
					message: `Publisher agent failed: ${error}`,
				});
			}

			const response = responseResult.right;
			const result = parsePublisherOutput(response.text);

			if (!result.success) {
				yield* logError(`Publisher failed: ${result.summary}`);
				return yield* new PublishError({
					message: result.summary,
				});
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
