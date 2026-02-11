---
name: swarn
description: Execute a plan with parallel worker agents. Use when implementing multiple tasks concurrently — each task runs as an independent agent session, a judge reviews results, and failed tasks are retried with feedback.
metadata:
  author: geclos
  version: "0.1"
compatibility: Requires bun and a running OpenCode server (opencode serve)
allowed-tools: Bash(swarn:*)
---

# Swarn — Parallel Agent Swarm

You orchestrate a swarm of parallel worker agents to execute a plan.

## Steps

1. **Develop the plan** with the user as a JSON array of tasks
2. **Write the plan** to a `.json` file
3. **Run** `swarn --plan <file>` to execute

## Plan Format

Each task needs `title` and `description`. Optionally add `filePaths` (files the worker should focus on) and `dependencies` (titles of tasks that must complete first).

```json
[
  {
    "title": "Create User model",
    "description": "Create src/models/user.ts with a User interface and Zod schema.",
    "filePaths": ["src/models/user.ts"]
  },
  {
    "title": "Create auth routes",
    "description": "Create src/routes/auth.ts with login and register endpoints.",
    "filePaths": ["src/routes/auth.ts"],
    "dependencies": ["Create User model"]
  }
]
```

## CLI

```bash
swarn --plan plan.json
swarn --plan plan.json --workers 6 --iterations 3
swarn --plan plan.json --model anthropic/claude-opus-4-6
```

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--plan` | `-p` | stdin | Plan file or inline JSON |
| `--workers` | `-w` | `4` | Max parallel workers |
| `--iterations` | `-i` | `3` | Max judge review cycles |
| `--model` | `-m` | server default | Model as `provider/model` |
| `--dir` | `-d` | cwd | Working directory |
| `--server` | `-s` | `http://localhost:4096` | Backend server URL |
| `--verbose` | `-v` | `false` | Verbose output |

## Tips

- Keep task descriptions specific and self-contained — each worker only sees its own task
- Use `dependencies` to order tasks that build on each other
- Use `filePaths` to constrain scope and reduce conflicts between parallel workers
- The judge is pragmatic: 80% correct beats another iteration that might regress
