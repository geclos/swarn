export const PLANNER_MODEL = {
	model: { providerID: "openai", modelID: "gpt-5.3-codex" },
	thinking: "high" as const,
};

export const WORKER_MODEL = {
	model: { providerID: "openai", modelID: "gpt-5.3-codex" },
	thinking: "low" as const,
};

export const JUDGE_MODEL = {
	model: { providerID: "openai", modelID: "gpt-5.3-codex" },
	thinking: "high" as const,
};
