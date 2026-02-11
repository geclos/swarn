#!/usr/bin/env bun

import { parseArgs, readPlan } from "./cli.js"
import { setVerbose, log } from "./output/logger.js"
import { OpenCodeBackend } from "./backend/opencode.js"
import { SwarmStore } from "./store.js"
import { orchestrate } from "./orchestrator.js"
import { printReport } from "./output/reporter.js"

async function main() {
  const config = parseArgs(process.argv.slice(2))
  setVerbose(config.verbose)

  log.info("swarn starting...")

  // Read and validate plan
  let plan
  try {
    plan = await readPlan(config)
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
  log.info(`Plan loaded: ${plan.length} tasks`)

  // Connect to backend
  const backend = new OpenCodeBackend(config.serverUrl)
  const healthy = await backend.healthCheck()
  if (!healthy) {
    log.error(`Cannot reach OpenCode server at ${config.serverUrl}`)
    log.error("Start it with: opencode serve --port 4096")
    process.exit(1)
  }
  log.success(`Connected to OpenCode server at ${config.serverUrl}`)

  // Initialize store and register swarm
  const store = new SwarmStore()
  const swarmId = crypto.randomUUID()
  store.register(swarmId, plan, config)
  store.initTasks(swarmId, plan)
  log.info(`Swarm registered: ${swarmId}`)

  try {
    // Run orchestration
    const stats = await orchestrate(backend, config, store, swarmId)
    store.finish(swarmId, "completed")

    // Print report
    printReport(stats)

    process.exit(stats.tasksFailed > 0 ? 1 : 0)
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    store.finish(swarmId, "failed", error)
    throw err
  } finally {
    store.close()
  }
}

main().catch((err) => {
  log.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
