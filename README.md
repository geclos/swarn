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

## Dashboard

```bash
# Run the dashboard runtime server (default: http://127.0.0.1:4173)
bun run dashboard

# Run the Solid UI in Vite dev mode
bun run dashboard:ui:dev

# Build only the Solid UI bundle into src/dashboard/ui/dist/
bun run dashboard:ui:build

# Build the UI and launch the runtime server
bun run dashboard:build

# Run dashboard-focused backend tests
bun test src/dashboard
```

### Dashboard Troubleshooting

- `EADDRINUSE` or startup bind errors: set a different port with `DASHBOARD_PORT=4273 bun run dashboard`.
- Missing DB data (`[]` from `/api/swarms`): ensure swarm runs have created `~/.swarn/swarm.db` and you are using the same user/home directory.
- Dashboard UI shows stale/missing assets: rebuild with `bun run dashboard:ui:build` and then restart `bun run dashboard`.
- Vite dev mode API calls: the UI fetches `/api/*` on the same origin, so run it behind a proxy to the dashboard server if you need live UI HMR plus backend data.

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
