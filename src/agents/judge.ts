import type { AgentBackend } from "../backend/interface.js"
import type { Task } from "../taskboard/board.js"
import type { JudgeVerdict } from "../types.js"
import { judgePrompt } from "./prompts.js"
import { log } from "../output/logger.js"

interface JudgeResult {
  verdict: JudgeVerdict
  tokens: { input: number; output: number }
  cost: number
}

export async function executeJudge(
  backend: AgentBackend,
  allTasks: Task[],
  workingDir: string,
  model?: { providerID: string; modelID: string } | null,
): Promise<JudgeResult> {
  const completedTasks = allTasks.filter((t) => t.status === "completed")
  const failedTasks = allTasks.filter((t) => t.status === "failed")

  const sessionId = await backend.createSession({
    title: "swarn-judge",
    mode: "plan",
    workingDir,
    model: model ?? undefined,
  })

  try {
    log.judge("Reviewing task results...")
    const prompt = judgePrompt(allTasks, completedTasks, failedTasks)
    const response = await backend.prompt(sessionId, prompt, { agent: "plan" })

    const verdict = parseVerdict(response.text)
    log.judge(`Verdict: ${verdict.verdict} (score: ${verdict.score})`)

    if (verdict.verdict === "iterate" && verdict.failedTasks.length > 0) {
      log.judge(`${verdict.failedTasks.length} tasks need revision`)
    }

    return {
      verdict,
      tokens: response.tokens,
      cost: response.cost,
    }
  } finally {
    try {
      await backend.destroySession(sessionId)
    } catch {
      log.debug(`Failed to destroy judge session ${sessionId}`)
    }
  }
}

function parseVerdict(text: string): JudgeVerdict {
  const jsonMatch = text.match(/```json\n([\s\S]*?)```/)
  if (jsonMatch?.[1]) {
    try {
      return JSON.parse(jsonMatch[1]) as JudgeVerdict
    } catch {
      // fall through to defaults
    }
  }

  // Try parsing the entire text as JSON
  try {
    return JSON.parse(text) as JudgeVerdict
  } catch {
    // fall through
  }

  // Best-effort extraction
  const isDone = /verdict.*done/i.test(text) || /all tasks.*complet/i.test(text)
  return {
    verdict: isDone ? "done" : "iterate",
    score: isDone ? 80 : 40,
    feedback: text.slice(-500),
    failedTasks: [],
  }
}
