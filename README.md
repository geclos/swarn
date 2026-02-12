# swarn

Agentic swarm platform for executing software engineering plans with parallel AI workers.

## Overview

Swarn takes a high-level plan (e.g., "Refactor auth to use JWT") and executes it autonomously using a swarm of AI agents:

1. **Planner Agent** - Explores your codebase and breaks the plan into concrete, executable tasks with dependencies
2. **Worker Agents** - Execute tasks in parallel (up to N workers), respecting task dependencies
3. **Judge Agent** - Reviews results and decides whether to complete or iterate on failed tasks

## Installation

Requires [Bun](https://bun.sh):

```bash
bun install
```

## Usage

```bash
# Run with a plan file
swarn --plan request.md

# Pipe a plan via stdin
echo "Rewrite auth to use JWT" | swarn

# Control parallelism and iterations
swarn --plan request.md --workers 6 --iterations 3

# Use a specific model
swarn --plan request.md --model openai/gpt-4o
```

### CLI Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--plan` | `-p` | Plan file path or inline text | stdin |
| `--workers` | `-w` | Max parallel workers | 4 |
| `--iterations` | `-i` | Max judge iterations | 3 |
| `--model` | `-m` | Model as provider/model | server default |
| `--dir` | `-d` | Working directory | cwd |
| `--server` | `-s` | OpenCode server URL | localhost:4096 |
| `--verbose` | `-v` | Verbose logging | false |
| `--help` | `-h` | Show help | - |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     swarn                            │
├─────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Planner  │  │ Workers  │  │  Judge   │          │
│  │  Agent   │→ │ (N par)  │→ │  Agent   │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│       ↓              ↓              ↓               │
│  ┌──────────────────────────────────────────┐      │
│  │         OpenCode Backend                  │      │
│  │   (sessions, prompts, permissions)        │      │
│  └──────────────────────────────────────────┘      │
├─────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ SQLite   │  │ Git      │  │ Console  │          │
│  │ (tasks)  │  │ Worktrees│  │ Reporter │          │
│  └──────────┘  └──────────┘  └──────────┘          │
└─────────────────────────────────────────────────────┘
```

## How It Works

1. **Plan Input** - You provide a natural language description of what needs to be done
2. **Planning Phase** - The planner agent explores your codebase and creates a detailed task DAG
3. **Work Phase** - Workers claim and execute tasks in parallel, respecting dependencies
4. **Judge Phase** - When all tasks complete, the judge reviews the implementation
5. **Iteration** - Failed tasks get feedback and are retried (up to max iterations)

## Development

```bash
# Run in dev mode
bun run dev

# Build
bun run build

# Lint and typecheck
bun run lint

# Format code
bun run format

# Run tests
bun test
```

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **Effects**: Effect library for async/error handling
- **Database**: SQLite with Drizzle ORM
- **Linting**: Biome
- **Backend**: OpenCode SDK

## Requirements

- Bun 1.0+
- OpenCode server running (default: `http://localhost:4096`)
- Git repository (for worktree isolation)

## License

MIT
