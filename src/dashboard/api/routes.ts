import { jsonError, jsonSuccess, optionsResponse } from "./http.js";
import { getSwarmDetail, listSwarms } from "./repositories/swarms.js";
import { listTasksBySwarmId } from "./repositories/tasks.js";

export function handleApiRequest(request: Request, url: URL): Response | null {
	if (!url.pathname.startsWith("/api")) {
		return null;
	}

	if (request.method === "OPTIONS") {
		return optionsResponse();
	}

	if (request.method !== "GET") {
		return jsonError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
	}

	try {
		if (url.pathname === "/api/health") {
			return jsonSuccess({ status: "ok" });
		}

		if (url.pathname === "/api/swarms") {
			const swarms = listSwarms();
			return jsonSuccess(swarms);
		}

		const swarmDetailMatch = /^\/api\/swarms\/(\d+)$/.exec(url.pathname);
		if (swarmDetailMatch) {
			const rawSwarmId = swarmDetailMatch[1];
			if (!rawSwarmId) {
				return jsonError(404, "NOT_FOUND", "Route not found");
			}

			const swarmId = Number.parseInt(rawSwarmId, 10);
			const swarm = getSwarmDetail(swarmId);
			if (!swarm) {
				return jsonError(404, "SWARM_NOT_FOUND", "Swarm not found");
			}

			return jsonSuccess(swarm);
		}

		const swarmTasksMatch = /^\/api\/swarms\/(\d+)\/tasks$/.exec(url.pathname);
		if (swarmTasksMatch) {
			const rawSwarmId = swarmTasksMatch[1];
			if (!rawSwarmId) {
				return jsonError(404, "NOT_FOUND", "Route not found");
			}

			const swarmId = Number.parseInt(rawSwarmId, 10);
			const swarm = getSwarmDetail(swarmId);
			if (!swarm) {
				return jsonError(404, "SWARM_NOT_FOUND", "Swarm not found");
			}

			const tasks = listTasksBySwarmId(swarmId);
			return jsonSuccess(tasks);
		}

		return jsonError(404, "NOT_FOUND", "Route not found");
	} catch {
		return jsonError(500, "INTERNAL_ERROR", "Unexpected server error");
	}
}
