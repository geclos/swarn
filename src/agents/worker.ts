import type { AgentBackend } from "../backend/interface.js"
import type { Task, TaskResult } from "../taskboard/board.js"
import { workerPrompt } from "./prompts.js"
import { log } from "../output/logger.js"

interface WorkerResult {
  taskId: string
  success: boolean
  result: TaskResult
  tokens: { input: number; output: number }
  cost: number
}

export async function executeWorker(
  backend: AgentBackend,
  task: Task,
  workingDir: string,
  model?: { providerID: string; modelID: string } | null,
): Promise<WorkerResult> {
  const sessionId = await backend.createSession({
    title: `swarn-worker: ${task.title}`,
    mode: "build",
    workingDir,
    model: model ?? undefined,
  })

  try {
    log.worker(sessionId, `Starting: ${task.title}`)
    const prompt = workerPrompt(task)
    const response = await backend.prompt(sessionId, prompt)

    const result = parseSummary(response.text, task.filePaths)
    log.worker(sessionId, `Done: ${task.title} — ${result.filesModified.length} files`)

    return {
      taskId: task.id,
      success: true,
      result,
      tokens: response.tokens,
      cost: response.cost,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    log.error(`Worker failed for "${task.title}": ${error}`)
    return {
      taskId: task.id,
      success: false,
      result: { summary: "", filesModified: [], error },
      tokens: { input: 0, output: 0 },
      cost: 0,
    }
  } finally {
    try {
      await backend.destroySession(sessionId)
    } catch {
      log.debug(`Failed to destroy session ${sessionId}`)
    }
  }
}

function parseSummary(text: string, fallbackFiles: string[]): TaskResult {
  const summaryMatch = text.match(/```summary\n([\s\S]*?)```/)
  if (!summaryMatch?.[1]) {
    return {
      summary: text.slice(-500),
      filesModified: fallbackFiles,
    }
  }

  const block = summaryMatch[1]
  const filesLine = block.match(/Files modified:\s*(.+)/i)
  const summaryLine = block.match(/Summary:\s*(.+)/is)

  const filesModified = filesLine?.[1]
    ? filesLine[1].split(",").map((f) => f.trim()).filter(Boolean)
    : fallbackFiles

  return {
    summary: summaryLine?.[1]?.trim() ?? "",
    filesModified,
  }
}
