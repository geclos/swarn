# AGENTS.md

Agentic coding guidelines for the swarn repository.

## Build/Lint/Test Commands

```bash
# Development
bun run src/index.ts                    # Run in dev mode
bun run dev                             # Same as above

# Build
bun run build                           # Build to dist/ (bundled for Bun)

# Linting & Formatting (uses Biome, not ESLint/Prettier)
bun run lint                            # Type check + Biome lint
bun run format                          # Format code
bun run check                           # Lint + auto-fix issues

# Testing (Bun's built-in test runner)
bun test                                # Run all tests
bun test <pattern>                      # Run tests matching pattern
bun test --watch                        # Watch mode
bun test src/agents/worker.test.ts      # Run single test file
```

## Code Style

### Language & Runtime
- **Runtime**: Bun (not Node.js)
- **TypeScript**: Strict mode enabled
- **Module system**: ES modules (`"type": "module"` in package.json)
- **Target**: ESNext

### Formatting (Biome)
- **Indentation**: Tabs
- **Quotes**: Double quotes for JavaScript/TypeScript
- **Line endings**: LF
- **Max line length**: Default (80)

### Naming Conventions
- **Files**: `kebab-case.ts` (e.g., `claim-task.ts`, `orchestrator.ts`)
- **Functions/Variables**: `camelCase` (e.g., `executeWorker`, `logInfo`)
- **Types/Interfaces/Classes**: `PascalCase` (e.g., `AgentBackend`, `RunStats`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `WORKER_MODEL`)
- **Effect Errors**: `PascalCase` with `Error` suffix (e.g., `BackendError`)

### Import Conventions
- Use `.js` extension on all imports (even TypeScript files)
- Example: `import { executeWorker } from "./agents/worker.js"`
- Group imports: external libraries → internal modules → types
- Use `import type` for type-only imports

### TypeScript Patterns
- Use `Effect.Effect<Success, Error>` for effectful computations
- Define errors using `Data.TaggedError` from Effect
- Prefer `interface` over `type` for object shapes
- Use explicit return types on exported functions
- Enable `noUncheckedIndexedAccess` in tsconfig

### Error Handling
- Use Effect's `Either` for error recovery
- Use `Effect.orDie` for fatal errors
- Wrap external API calls in `Effect.either`
- Define domain-specific error types in `models/errors.ts`

### File Organization
```
src/
├── agents/           # Agent implementations (planner, worker, judge)
├── backend/          # Backend interface and implementations
├── libs/             # Shared utilities (db, etc.)
├── models/           # Types, interfaces, errors
├── output/           # Logging and reporting
├── repositories/     # Data access layer
├── services/         # Business logic (swarms/, tasks/)
├── cli.ts            # CLI argument parsing
├── config.ts         # Configuration
├── index.ts          # Entry point
├── orchestrator.ts   # Main orchestration logic
└── worktree.ts       # Git worktree utilities
```

## Key Technologies

- **[Effect](https://effect.website/)**: Functional effect system for async/error handling
- **[Bun](https://bun.sh/)**: Runtime, bundler, test runner
- **[Biome](https://biomejs.dev/)**: Linting and formatting
- **[Drizzle ORM](https://orm.drizzle.team/)**: Type-safe SQL (for SQLite)
- **SQLite**: Local database via `bun:sqlite`

## Notes

- Never commit secrets or API keys
- Always run `bun run lint` before submitting changes
- The codebase uses Effect heavily — embrace functional patterns
- SQLite is used for swarm/task state persistence
- Git worktrees are used for isolation (see `worktree.ts`)
