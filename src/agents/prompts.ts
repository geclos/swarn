import type { Task } from "../taskboard/board.js"

export function workerPrompt(task: Task): string {
  let prompt = `You are a focused engineer implementing one specific task. Complete the task fully — no TODOs, no placeholders. Follow existing code patterns and conventions. Stay within scope (only modify files relevant to the task). Run tests/lint if available to verify work. When done, summarize what you changed.

## Task: ${task.title}

${task.description}`

  if (task.filePaths.length > 0) {
    prompt += `\n\n## Target Files\n${task.filePaths.map((f) => `- ${f}`).join("\n")}`
  }

  if (task.judgeFeedback) {
    prompt += `\n\n## Feedback from Previous Review\nThis task was reviewed and needs revision:\n${task.judgeFeedback}`
  }

  prompt += `\n\n## Output Format
When you are done, end your response with a summary block:
\`\`\`summary
Files modified: <comma-separated list of files you created or modified>
Summary: <one paragraph describing what you did>
\`\`\``

  return prompt
}

export function judgePrompt(plan: Task[], completedTasks: Task[], failedTasks: Task[]): string {
  const planOverview = plan
    .map((t) => `- [${t.id}] ${t.title}: ${t.description.slice(0, 120)}...`)
    .join("\n")

  const completedSummary = completedTasks
    .map((t) => {
      const result = t.result
        ? `Summary: ${t.result.summary}\nFiles: ${t.result.filesModified.join(", ")}`
        : "No result recorded"
      return `- [${t.id}] ${t.title}\n  ${result}`
    })
    .join("\n")

  const failedSummary = failedTasks
    .map((t) => {
      const err = t.result?.error ?? "Unknown error"
      return `- [${t.id}] ${t.title}\n  Error: ${err}`
    })
    .join("\n")

  return `You are a senior engineer reviewing implementation against a plan. Each task had specific requirements — check if they were met. Check: completeness, correctness, code quality, no regressions. Be pragmatic — 80% correct beats another iteration that might regress. If iterating: provide specific, actionable feedback per failed task.

## Original Plan
${planOverview}

## Completed Tasks
${completedSummary || "None"}

## Failed Tasks
${failedSummary || "None"}

## Instructions
1. Review the code changes by examining the files listed in each completed task
2. Check that each task's requirements from the plan were met
3. Output your verdict as a JSON block:

\`\`\`json
{
  "verdict": "done" | "iterate",
  "score": <0-100>,
  "feedback": "<overall assessment>",
  "failedTasks": [
    {
      "taskId": "<id>",
      "reason": "<what's wrong>",
      "suggestion": "<specific fix>"
    }
  ]
}
\`\`\``
}
