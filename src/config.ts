import { join } from "node:path"
import { homedir } from "node:os"
import type { SwarnConfig } from "./types.js"

export const defaults: SwarnConfig = {
  planSource: null,
  maxWorkers: 4,
  maxIterations: 3,
  model: null,
  workingDir: process.cwd(),
  serverUrl: process.env.SWARN_SERVER_URL ?? "http://localhost:4096",
  verbose: false,
}

export const SWARN_HOME = join(homedir(), ".swarn")
export const SWARN_DB = join(SWARN_HOME, "swarm.db")
