---
name: swarn
description: Execute a plan with parallel worker agents. Describe what you want in freeform text — a planner agent explores the codebase, produces a detailed task plan, workers execute in parallel, and a judge reviews and iterates.
metadata:
  author: geclos
  version: "0.2"
compatibility: Requires bun and a running OpenCode server (opencode serve)
allowed-tools: Bash(swarn:*)
---

# Swarn — Parallel Agent Swarm

You orchestrate a swarm of parallel worker agents to execute a plan.

## Steps

1. **Write the request** with the user as freeform markdown/text describing what needs to be done. Explore the codebase and produce a decently detailed PRD plan. Ask clarifying questions as needed.
2. **Save the PRD plan** to a file (e.g. `plan.md`)
3. **Run** `swarn --plan <file>` — the planner agent explores the codebase and produces a detailed execution plan, then workers execute it

## How It Works

When run inside a git repo, swarn auto-creates an isolated git worktree under `~/.swarn/worktrees/` so agents never touch your working copy. Results stay in the worktree for you to inspect and merge.

```
User request (markdown) → Planner → Workers (parallel) → Judge → iterate or done
```

**Planner** (codex-5.3, high thinking) — Reads the request, explores the codebase, and produces a detailed JSON task plan with dependencies.

**Workers** (codex-5.3, low thinking) — Execute tasks in parallel. Each worker gets a focused prompt with implementation-ready instructions.

**Judge** (codex-5.3, high thinking) — Reviews all results against the plan. Accepts good work or sends tasks back with specific feedback.

## Plan Format

Plans are freeform markdown or text. The planner agent converts them into structured tasks.

```markdown
Rewrite the auth system to use JWT instead of sessions.
The login and signup endpoints need to return tokens.
Add a middleware that validates tokens on protected routes.
```

The planner explores the codebase and produces tasks like:

- T-01: Create JWT utilities (no deps)
- T-02: Add auth middleware (depends on T-01)
- T-03: Update login/signup endpoints (depends on T-01)

## CLI

```bash
swarn --plan request.md
swarn --plan request.md --workers 6 --iterations 3
swarn --plan request.md --model anthropic/claude-opus-4-6
echo 'Add JWT auth to the API' | swarn
```

| Flag           | Short | Default                 | Description                        |
| -------------- | ----- | ----------------------- | ---------------------------------- |
| `--plan`       | `-p`  | stdin                   | Plan file or inline text           |
| `--workers`    | `-w`  | `4`                     | Max parallel workers               |
| `--iterations` | `-i`  | `3`                     | Max judge review cycles            |
| `--model`      | `-m`  | codex-5.3               | Model override as `provider/model` |
| `--dir`        | `-d`  | cwd                     | Working directory                  |
| `--server`     | `-s`  | `http://localhost:4096` | Backend server URL                 |
| `--verbose`    | `-v`  | `false`                 | Verbose output                     |

## Tips

- Write detailed requests — the planner produces better plans when given clear context
- The planner explores the codebase automatically, no need to be exhaustive in your request
- Task dependencies are handled automatically — the planner figures out task ordering
