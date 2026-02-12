# E2E Smoke Test

This folder contains a tiny mock repo and a default swarn instruction for quick end-to-end testing against the OpenCode backend.

Quick run:

1) Start the backend (if not already running):
   opencode serve --port 4096

2) Run swarn against the mock repo:
   bun run src/index.ts --plan tests/e2e/plan.md --dir tests/e2e/repo --verbose

Notes:
- The run will create a worktree under ~/.swarn/worktrees so you can inspect results.
- Use this to quickly debug planner/worker/judge behavior during the SQLite migration.
