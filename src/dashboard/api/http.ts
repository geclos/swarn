export interface ApiSuccessEnvelope<T> {
	ok: true;
	data: T;
}

export interface ApiErrorEnvelope {
	ok: false;
	error: {
		code: string;
		message: string;
	};
}

const API_BASE_HEADERS = {
	"content-type": "application/json; charset=utf-8",
	"cache-control": "no-store",
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "GET, OPTIONS",
	"access-control-allow-headers": "Content-Type",
	vary: "Origin",
} as const;

export function jsonSuccess<T>(
	data: T,
	init?: Omit<ResponseInit, "headers">,
): Response {
	const body: ApiSuccessEnvelope<T> = { ok: true, data };
	return Response.json(body, {
		status: 200,
		...init,
		headers: {
			...API_BASE_HEADERS,
		},
	});
}

export function jsonError(
	status: number,
	code: string,
	message: string,
): Response {
	const body: ApiErrorEnvelope = {
		ok: false,
		error: {
			code,
			message,
		},
	};

	return Response.json(body, {
		status,
		headers: {
			...API_BASE_HEADERS,
		},
	});
}

export function optionsResponse(): Response {
	return new Response(null, {
		status: 204,
		headers: {
			...API_BASE_HEADERS,
		},
	});
}
