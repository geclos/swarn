import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk"
import type { AgentBackend, SessionOpts, PromptOpts, AgentResponse } from "./interface.js"
import { log } from "../output/logger.js"

export class OpenCodeBackend implements AgentBackend {
  private client: OpencodeClient

  constructor(serverUrl: string) {
    this.client = createOpencodeClient({ baseUrl: serverUrl })
  }

  async createSession(opts: SessionOpts): Promise<string> {
    const resp = await this.client.session.create({
      body: { title: opts.title },
      query: { directory: opts.workingDir },
    })
    if (!resp.data) {
      throw new Error(`Failed to create session: ${JSON.stringify(resp.error)}`)
    }
    log.debug(`Created session ${resp.data.id} for "${opts.title}"`)
    return resp.data.id
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.client.session.delete({
      path: { id: sessionId },
    })
    log.debug(`Destroyed session ${sessionId}`)
  }

  async prompt(sessionId: string, message: string, opts?: PromptOpts): Promise<AgentResponse> {
    const resp = await this.client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text: message }],
        agent: opts?.agent ?? "code",
      },
    })

    if (!resp.data) {
      throw new Error(`Prompt failed for session ${sessionId}: ${JSON.stringify(resp.error)}`)
    }

    const { info, parts } = resp.data
    const textParts = parts
      .filter((p): p is Extract<typeof p, { type: "text" }> => "type" in p && p.type === "text")
      .map((p) => p.text)

    return {
      text: textParts.join("\n"),
      parts,
      tokens: { input: info.tokens.input, output: info.tokens.output },
      cost: info.cost,
    }
  }

  async getStatus(sessionId: string): Promise<"idle" | "busy" | "error"> {
    try {
      const resp = await this.client.session.status({})
      if (!resp.data) return "error"
      const status = resp.data[sessionId]
      if (!status) return "idle"
      return status.type === "busy" ? "busy" : "idle"
    } catch {
      return "error"
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.session.list({})
      return true
    } catch {
      return false
    }
  }
}
