import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { handleApiRequest } from "./api/routes.js";

const DASHBOARD_PORT = Number.parseInt(
	process.env.DASHBOARD_PORT ?? process.env.PORT ?? "4173",
	10,
);
const DASHBOARD_HOST = process.env.DASHBOARD_HOST ?? "127.0.0.1";

const DASHBOARD_DIST_DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	"ui",
	"dist",
);
const INDEX_HTML_PATH = join(DASHBOARD_DIST_DIR, "index.html");

function isSafeDashboardPath(path: string): boolean {
	return (
		path === DASHBOARD_DIST_DIR ||
		path.startsWith(`${DASHBOARD_DIST_DIR}${sep}`)
	);
}

function resolveStaticFilePath(pathname: string): string {
	const decodedPath = decodeURIComponent(pathname);
	const relativePath =
		decodedPath === "/" ? "index.html" : decodedPath.slice(1);
	const candidatePath = normalize(join(DASHBOARD_DIST_DIR, relativePath));

	if (!isSafeDashboardPath(candidatePath)) {
		return INDEX_HTML_PATH;
	}

	return candidatePath;
}

function staticCacheControl(path: string): string {
	if (path.endsWith(".html")) {
		return "no-cache";
	}

	if (path.includes(`${sep}assets${sep}`) && extname(path).length > 0) {
		return "public, max-age=31536000, immutable";
	}

	return "public, max-age=3600";
}

function createStaticResponse(path: string): Response {
	const file = Bun.file(path);
	return new Response(file, {
		headers: {
			"cache-control": staticCacheControl(path),
		},
	});
}

async function serveStaticAsset(pathname: string): Promise<Response> {
	if (pathname !== "/") {
		const filePath = resolveStaticFilePath(pathname);
		const file = Bun.file(filePath);
		if (await file.exists()) {
			return createStaticResponse(filePath);
		}
	}

	const indexFile = Bun.file(INDEX_HTML_PATH);
	if (!(await indexFile.exists())) {
		return new Response("Dashboard UI build not found", {
			status: 404,
			headers: {
				"cache-control": "no-store",
			},
		});
	}

	return createStaticResponse(INDEX_HTML_PATH);
}

const server = Bun.serve({
	hostname: DASHBOARD_HOST,
	port: DASHBOARD_PORT,
	async fetch(request) {
		const url = new URL(request.url);

		const apiResponse = handleApiRequest(request, url);
		if (apiResponse) {
			return apiResponse;
		}

		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method not allowed", {
				status: 405,
				headers: {
					"cache-control": "no-store",
				},
			});
		}

		return serveStaticAsset(url.pathname);
	},
});

console.log(
	`Swarn dashboard listening at http://${server.hostname}:${server.port}`,
);
