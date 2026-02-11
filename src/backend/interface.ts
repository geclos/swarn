export interface SessionOpts {
  title: string
  mode: "plan" | "build"
  workingDir: string
  model?: { providerID: string; modelID: string }
}

export interface PromptOpts {
  agent?: string
}

export interface AgentResponse {
  text: string
  parts: unknown[]
  tokens: { input: number; output: number }
  cost: number
}

export interface AgentBackend {
  createSession(opts: SessionOpts): Promise<string>
  destroySession(sessionId: string): Promise<void>
  prompt(sessionId: string, message: string, opts?: PromptOpts): Promise<AgentResponse>
  getStatus(sessionId: string): Promise<"idle" | "busy" | "error">
}
