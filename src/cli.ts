import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { PlanTask, SwarnConfig } from "./types.js"
import { defaults } from "./config.js"

export function parseArgs(args: string[]): SwarnConfig {
  const config: SwarnConfig = { ...defaults }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    const next = args[i + 1]

    switch (arg) {
      case "--plan":
      case "-p":
        config.planSource = next ?? null
        i++
        break
      case "--workers":
      case "-w":
        config.maxWorkers = parseInt(next ?? "4", 10)
        i++
        break
      case "--iterations":
      case "-i":
        config.maxIterations = parseInt(next ?? "3", 10)
        i++
        break
      case "--model":
      case "-m": {
        if (next) {
          const [providerID, ...rest] = next.split("/")
          const modelID = rest.join("/")
          if (providerID && modelID) {
            config.model = { providerID, modelID }
          }
        }
        i++
        break
      }
      case "--dir":
      case "-d":
        config.workingDir = resolve(next ?? process.cwd())
        i++
        break
      case "--server":
      case "-s":
        config.serverUrl = next ?? config.serverUrl
        i++
        break
      case "--verbose":
      case "-v":
        config.verbose = true
        break
      case "--help":
      case "-h":
        printHelp()
        process.exit(0)
    }
  }

  return config
}

export async function readPlan(config: SwarnConfig): Promise<PlanTask[]> {
  let raw: string

  if (config.planSource) {
    // Could be a file path or inline JSON
    if (config.planSource.startsWith("[") || config.planSource.startsWith("{")) {
      raw = config.planSource
    } else {
      raw = readFileSync(resolve(config.planSource), "utf-8")
    }
  } else {
    // Read from stdin
    raw = await readStdin()
  }

  const plan = JSON.parse(raw) as PlanTask[]

  if (!Array.isArray(plan) || plan.length === 0) {
    throw new Error("Plan must be a non-empty JSON array of tasks")
  }

  for (const [i, task] of plan.entries()) {
    if (!task.title || !task.description) {
      throw new Error(`Task ${i} missing required fields: title, description`)
    }
  }

  return plan
}

async function readStdin(): Promise<string> {
  // Check if stdin is a TTY (no piped input)
  if (process.stdin.isTTY) {
    throw new Error("No plan provided. Use --plan <file>, pipe via stdin, or pass inline JSON.")
  }

  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString("utf-8")
}

function printHelp(): void {
  console.log(`
\x1b[1mswarn\x1b[0m — Execute plans with parallel worker agents

\x1b[1mUSAGE\x1b[0m
  swarn --plan <file|json>
  echo '<json>' | swarn
  swarn --plan plan.json --workers 6 --iterations 3

\x1b[1mOPTIONS\x1b[0m
  -p, --plan <path|json>   Plan file path or inline JSON (default: stdin)
  -w, --workers <n>        Max parallel workers (default: 4)
  -i, --iterations <n>     Max judge iterations (default: 3)
  -m, --model <p/m>        Model as provider/model
  -d, --dir <path>         Working directory (default: cwd)
  -s, --server <url>       OpenCode server URL (default: http://localhost:4096)
  -v, --verbose            Verbose logging
  -h, --help               Show this help

\x1b[1mPLAN FORMAT\x1b[0m
  [
    {
      "title": "Task name",
      "description": "Detailed instructions",
      "filePaths": ["src/file.ts"],
      "dependencies": ["Other task title"]
    }
  ]
`)
}
