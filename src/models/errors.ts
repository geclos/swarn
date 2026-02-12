import { Data } from "effect";

export class BackendError extends Data.TaggedError("BackendError")<{
	message: string;
	cause?: unknown;
}> {}

export class SessionError extends Data.TaggedError("SessionError")<{
	message: string;
	sessionId?: string;
}> {}

export class PromptError extends Data.TaggedError("PromptError")<{
	message: string;
	sessionId?: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
	message: string;
}> {}

export class ParseError extends Data.TaggedError("ParseError")<{
	message: string;
	source?: string;
}> {}

export type SwarnError =
	| BackendError
	| SessionError
	| PromptError
	| ValidationError
	| ParseError;
