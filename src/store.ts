import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { SWARN_HOME, SWARN_DB } from "./config.js"
import type { PlanTask, SwarnConfig, SwarmStatus } from "./types.js"
import type { Task, TaskResult, BoardSummary } from "./taskboard/board.js"

export interface SwarmRow {
  id: string
  status: SwarmStatus
  working_dir: string
  plan: string
  config: string
  iteration: number
  max_iterations: number
  tasks_total: number
  tasks_completed: number
  tasks_failed: number
  tokens_in: number
  tokens_out: number
  cost: number
  error: string | null
  pid: number
  created_at: string
  updated_at: string
}

export interface SwarmRecord extends SwarmRow {
  tasks?: Task[]
}

export interface ProgressStats {
  iteration?: number
  tokensIn?: number
  tokensOut?: number
  cost?: number
}

export class SwarmStore {
  private db: Database

  constructor() {
    mkdirSync(SWARN_HOME, { recursive: true })
    this.db = new Database(SWARN_DB)
    this.db.exec("PRAGMA journal_mode=WAL")
    this.db.exec("PRAGMA busy_timeout=5000")
    this.createTables()
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS swarms (
        id              TEXT PRIMARY KEY,
        status          TEXT NOT NULL,
        working_dir     TEXT NOT NULL,
        plan            TEXT NOT NULL,
        config          TEXT NOT NULL,
        iteration       INTEGER NOT NULL DEFAULT 0,
        max_iterations  INTEGER NOT NULL,
        tasks_total     INTEGER NOT NULL DEFAULT 0,
        tasks_completed INTEGER NOT NULL DEFAULT 0,
        tasks_failed    INTEGER NOT NULL DEFAULT 0,
        tokens_in       INTEGER NOT NULL DEFAULT 0,
        tokens_out      INTEGER NOT NULL DEFAULT 0,
        cost            REAL NOT NULL DEFAULT 0,
        error           TEXT,
        pid             INTEGER NOT NULL,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      )
    `)

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id              TEXT NOT NULL,
        swarm_id        TEXT NOT NULL REFERENCES swarms(id),
        title           TEXT NOT NULL,
        description     TEXT NOT NULL,
        status          TEXT NOT NULL,
        file_paths      TEXT NOT NULL,
        dependencies    TEXT NOT NULL,
        claimed_by      TEXT,
        result_summary  TEXT,
        files_modified  TEXT,
        error           TEXT,
        iteration       INTEGER NOT NULL DEFAULT 0,
        judge_feedback  TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        PRIMARY KEY (swarm_id, id)
      )
    `)
  }

  // -- Swarm lifecycle --

  register(id: string, plan: PlanTask[], config: SwarnConfig): void {
    const now = new Date().toISOString()
    this.db.run(
      `INSERT INTO swarms (id, status, working_dir, plan, config, max_iterations, tasks_total, pid, created_at, updated_at)
       VALUES (?, 'running', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, config.workingDir, JSON.stringify(plan), JSON.stringify(config), config.maxIterations, plan.length, process.pid, now, now],
    )
  }

  updateProgress(id: string, stats: ProgressStats): void {
    const sets: string[] = []
    const params: (string | number)[] = []

    if (stats.iteration !== undefined) {
      sets.push("iteration = ?")
      params.push(stats.iteration)
    }
    if (stats.tokensIn !== undefined) {
      sets.push("tokens_in = ?")
      params.push(stats.tokensIn)
    }
    if (stats.tokensOut !== undefined) {
      sets.push("tokens_out = ?")
      params.push(stats.tokensOut)
    }
    if (stats.cost !== undefined) {
      sets.push("cost = ?")
      params.push(stats.cost)
    }

    // Always refresh task counts from actual task data
    sets.push("tasks_completed = (SELECT COUNT(*) FROM tasks WHERE swarm_id = ? AND status = 'completed')")
    params.push(id)
    sets.push("tasks_failed = (SELECT COUNT(*) FROM tasks WHERE swarm_id = ? AND status = 'failed')")
    params.push(id)

    sets.push("updated_at = ?")
    const now = new Date().toISOString()
    params.push(now)

    params.push(id)
    this.db.run(`UPDATE swarms SET ${sets.join(", ")} WHERE id = ?`, params)
  }

  finish(id: string, status: SwarmStatus, error?: string): void {
    const now = new Date().toISOString()
    this.db.run(
      `UPDATE swarms SET status = ?, error = ?, updated_at = ?,
        tasks_completed = (SELECT COUNT(*) FROM tasks WHERE swarm_id = ? AND status = 'completed'),
        tasks_failed = (SELECT COUNT(*) FROM tasks WHERE swarm_id = ? AND status = 'failed')
       WHERE id = ?`,
      [status, error ?? null, now, id, id, id],
    )
  }

  list(filter?: { status?: SwarmStatus }): SwarmRow[] {
    if (filter?.status) {
      return this.db.query("SELECT * FROM swarms WHERE status = ? ORDER BY created_at DESC").all(filter.status) as SwarmRow[]
    }
    return this.db.query("SELECT * FROM swarms ORDER BY created_at DESC").all() as SwarmRow[]
  }

  get(id: string): SwarmRecord | null {
    const swarm = this.db.query("SELECT * FROM swarms WHERE id = ?").get(id) as SwarmRow | null
    if (!swarm) return null
    const taskRows = this.db.query("SELECT * FROM tasks WHERE swarm_id = ? ORDER BY id").all(id) as TaskRow[]
    return { ...swarm, tasks: taskRows.map(rowToTask) }
  }

  close(): void {
    this.db.close()
  }

  // -- Task operations --

  initTasks(swarmId: string, plan: PlanTask[]): void {
    const now = new Date().toISOString()
    const insert = this.db.prepare(
      `INSERT INTO tasks (id, swarm_id, title, description, status, file_paths, dependencies, iteration, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    )

    const tx = this.db.transaction(() => {
      for (let i = 0; i < plan.length; i++) {
        const p = plan[i]!
        const status = p.dependencies?.length ? "blocked" : "pending"
        insert.run(
          String(i),
          swarmId,
          p.title,
          p.description,
          status,
          JSON.stringify(p.filePaths ?? []),
          JSON.stringify(p.dependencies ?? []),
          now,
          now,
        )
      }
    })
    tx()
  }

  getClaimable(swarmId: string): Task[] {
    // Get all tasks for this swarm
    const allRows = this.db.query("SELECT * FROM tasks WHERE swarm_id = ?").all(swarmId) as TaskRow[]
    const completedTitles = new Set(
      allRows.filter((r) => r.status === "completed").map((r) => r.title),
    )
    const completedIds = new Set(
      allRows.filter((r) => r.status === "completed").map((r) => r.id),
    )

    return allRows
      .filter((r) => {
        if (r.status !== "pending") return false
        const deps: string[] = JSON.parse(r.dependencies)
        return deps.every((dep) => completedTitles.has(dep) || completedIds.has(dep))
      })
      .map(rowToTask)
  }

  claim(swarmId: string, taskId: string, sessionId: string): Task | null {
    const now = new Date().toISOString()
    const changes = this.db.run(
      `UPDATE tasks SET status = 'in_progress', claimed_by = ?, updated_at = ?
       WHERE swarm_id = ? AND id = ? AND status = 'pending'`,
      [sessionId, now, swarmId, taskId],
    )
    if (changes.changes === 0) return null
    const row = this.db.query("SELECT * FROM tasks WHERE swarm_id = ? AND id = ?").get(swarmId, taskId) as TaskRow
    return rowToTask(row)
  }

  complete(swarmId: string, taskId: string, result: TaskResult): void {
    const now = new Date().toISOString()

    const tx = this.db.transaction(() => {
      this.db.run(
        `UPDATE tasks SET status = 'completed', result_summary = ?, files_modified = ?, error = NULL, updated_at = ?
         WHERE swarm_id = ? AND id = ?`,
        [result.summary, JSON.stringify(result.filesModified), now, swarmId, taskId],
      )

      // Unblock dependent tasks
      this.unblockDependents(swarmId)
    })
    tx()
  }

  fail(swarmId: string, taskId: string, error: string): void {
    const now = new Date().toISOString()
    this.db.run(
      `UPDATE tasks SET status = 'failed', error = ?, result_summary = '', files_modified = '[]', updated_at = ?
       WHERE swarm_id = ? AND id = ?`,
      [error, now, swarmId, taskId],
    )
  }

  markForRetry(swarmId: string, taskId: string, feedback: string): void {
    const now = new Date().toISOString()
    this.db.run(
      `UPDATE tasks SET status = 'pending', claimed_by = NULL, judge_feedback = ?, iteration = iteration + 1, updated_at = ?
       WHERE swarm_id = ? AND id = ?`,
      [feedback, now, swarmId, taskId],
    )
  }

  getTasks(swarmId: string): Task[] {
    const rows = this.db.query("SELECT * FROM tasks WHERE swarm_id = ? ORDER BY id").all(swarmId) as TaskRow[]
    return rows.map(rowToTask)
  }

  getSummary(swarmId: string): BoardSummary {
    const row = this.db
      .query(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
        FROM tasks WHERE swarm_id = ?`,
      )
      .get(swarmId) as BoardSummary
    return row
  }

  getFilesChanged(swarmId: string): string[] {
    const rows = this.db
      .query("SELECT files_modified FROM tasks WHERE swarm_id = ? AND status = 'completed' AND files_modified IS NOT NULL")
      .all(swarmId) as { files_modified: string }[]
    const files = new Set<string>()
    for (const r of rows) {
      for (const f of JSON.parse(r.files_modified) as string[]) {
        files.add(f)
      }
    }
    return [...files]
  }

  private unblockDependents(swarmId: string): void {
    const allRows = this.db.query("SELECT * FROM tasks WHERE swarm_id = ?").all(swarmId) as TaskRow[]
    const completedTitles = new Set(
      allRows.filter((r) => r.status === "completed").map((r) => r.title),
    )
    const completedIds = new Set(
      allRows.filter((r) => r.status === "completed").map((r) => r.id),
    )

    const now = new Date().toISOString()
    for (const r of allRows) {
      if (r.status !== "blocked") continue
      const deps: string[] = JSON.parse(r.dependencies)
      if (deps.every((dep) => completedTitles.has(dep) || completedIds.has(dep))) {
        this.db.run(
          "UPDATE tasks SET status = 'pending', updated_at = ? WHERE swarm_id = ? AND id = ?",
          [now, swarmId, r.id],
        )
      }
    }
  }
}

// -- Internal types and helpers --

interface TaskRow {
  id: string
  swarm_id: string
  title: string
  description: string
  status: string
  file_paths: string
  dependencies: string
  claimed_by: string | null
  result_summary: string | null
  files_modified: string | null
  error: string | null
  iteration: number
  judge_feedback: string | null
  created_at: string
  updated_at: string
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as Task["status"],
    filePaths: JSON.parse(row.file_paths),
    dependencies: JSON.parse(row.dependencies),
    claimedBy: row.claimed_by,
    result:
      row.result_summary !== null
        ? {
            summary: row.result_summary,
            filesModified: row.files_modified ? JSON.parse(row.files_modified) : [],
            error: row.error ?? undefined,
          }
        : null,
    iteration: row.iteration,
    judgeFeedback: row.judge_feedback ?? undefined,
  }
}
