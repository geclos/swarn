import type { AgentBackend } from "./backend/interface.js"
import type { SwarnConfig, RunStats } from "./types.js"
import type { SwarmStore } from "./store.js"
import { executeWorker } from "./agents/worker.js"
import { executeJudge } from "./agents/judge.js"
import { log } from "./output/logger.js"

export async function orchestrate(
  backend: AgentBackend,
  config: SwarnConfig,
  store: SwarmStore,
  swarmId: string,
): Promise<RunStats> {
  const startTime = Date.now()
  const stats: RunStats = {
    iterations: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    totalTokens: { input: 0, output: 0 },
    totalCost: 0,
    filesChanged: [],
    duration: 0,
  }

  for (let iteration = 1; iteration <= config.maxIterations; iteration++) {
    stats.iterations = iteration
    log.iteration(iteration, config.maxIterations)

    // Work phase: run all claimable tasks in parallel
    await workPhase(backend, store, swarmId, config, stats)

    store.updateProgress(swarmId, {
      iteration,
      tokensIn: stats.totalTokens.input,
      tokensOut: stats.totalTokens.output,
      cost: stats.totalCost,
    })

    const summary = store.getSummary(swarmId)
    log.info(`Tasks: ${summary.completed} done, ${summary.failed} failed, ${summary.pending + summary.blocked} remaining`)

    // If no tasks left to process, check with judge
    if (summary.pending === 0 && summary.inProgress === 0 && summary.blocked === 0) {
      // Judge phase
      const tasks = store.getTasks(swarmId)
      if (tasks.every((t) => t.status === "completed")) {
        // All done — still run judge for validation
        const judgeResult = await executeJudge(backend, tasks, config.workingDir, config.model)
        stats.totalTokens.input += judgeResult.tokens.input
        stats.totalTokens.output += judgeResult.tokens.output
        stats.totalCost += judgeResult.cost

        if (judgeResult.verdict.verdict === "done" || iteration === config.maxIterations) {
          break
        }

        // Judge wants iteration: mark failed tasks for retry
        for (const ft of judgeResult.verdict.failedTasks) {
          store.markForRetry(swarmId, ft.taskId, ft.suggestion)
        }
        continue
      }

      // Some tasks failed and none are pending — run judge
      const judgeResult = await executeJudge(backend, tasks, config.workingDir, config.model)
      stats.totalTokens.input += judgeResult.tokens.input
      stats.totalTokens.output += judgeResult.tokens.output
      stats.totalCost += judgeResult.cost

      if (judgeResult.verdict.verdict === "done" || iteration === config.maxIterations) {
        break
      }

      // Mark failed tasks for retry with judge feedback
      for (const ft of judgeResult.verdict.failedTasks) {
        store.markForRetry(swarmId, ft.taskId, ft.suggestion)
      }

      // Also retry any tasks that failed without specific judge feedback
      const failedWithoutFeedback = tasks.filter(
        (t) => t.status === "failed" && !judgeResult.verdict.failedTasks.some((ft) => ft.taskId === t.id),
      )
      for (const t of failedWithoutFeedback) {
        store.markForRetry(swarmId, t.id, judgeResult.verdict.feedback)
      }
    }

    store.updateProgress(swarmId, {
      iteration,
      tokensIn: stats.totalTokens.input,
      tokensOut: stats.totalTokens.output,
      cost: stats.totalCost,
    })
  }

  // Final stats
  const finalSummary = store.getSummary(swarmId)
  stats.tasksCompleted = finalSummary.completed
  stats.tasksFailed = finalSummary.failed
  stats.filesChanged = store.getFilesChanged(swarmId)
  stats.duration = Date.now() - startTime

  return stats
}

async function workPhase(
  backend: AgentBackend,
  store: SwarmStore,
  swarmId: string,
  config: SwarnConfig,
  stats: RunStats,
): Promise<void> {
  while (true) {
    const claimable = store.getClaimable(swarmId)
    if (claimable.length === 0) break

    // Process in batches of maxWorkers
    const batch = claimable.slice(0, config.maxWorkers)
    log.info(`Dispatching ${batch.length} workers...`)

    const promises = batch.map(async (task) => {
      const claimed = store.claim(swarmId, task.id, "pending")
      if (!claimed) return

      const result = await executeWorker(backend, claimed, config.workingDir, config.model)

      if (result.success) {
        store.complete(swarmId, task.id, result.result)
      } else {
        store.fail(swarmId, task.id, result.result.error ?? "Unknown error")
      }

      stats.totalTokens.input += result.tokens.input
      stats.totalTokens.output += result.tokens.output
      stats.totalCost += result.cost
    })

    await Promise.allSettled(promises)
  }
}
