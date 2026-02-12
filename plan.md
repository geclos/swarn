Swarn Web Dashboard PRD

Goal
Build a local web dashboard to track all swarm runs and their task state in detail. The UI must be SolidJS. Everything else is open to choice. The dashboard is read-only and pulls live data from the existing SQLite database at ~/.swarn/swarm.db.

Audience
Developers running swarn locally who want real-time visibility into multiple swarms, task progress, and task outcomes.

Scope
1) API server that reads the existing SQLite DB and serves JSON.
2) SolidJS single-page UI that lists swarms and shows detailed swarm + task views.
3) Local dev workflow and build output served by the API server.

Non-goals
- No auth (localhost only)
- No write operations to the DB
- No remote hosting
- No websocket requirement (polling is OK)

Product Requirements
1) Swarm list view
   - Show all swarms, newest first.
   - Columns: ID, status, tasks completed/total, iteration, tokens in/out, cost, created time.
   - Indicate running swarms clearly.
   - Click through to detail view.

2) Swarm detail view
   - Header with: swarm ID, status, working dir, iterations, total tokens, total cost, duration, created/updated timestamps.
   - Task table/list with: task title, status, dependencies, claimed by, iteration, file paths.
   - Expandable task row for full description, result summary, files modified, error, judge feedback.
   - Show counts by status (pending, in_progress, blocked, completed, failed).

3) Live updates
   - Poll all visible data every 2s while any swarm is running.
   - Manual refresh button.

4) Visual design
   - Purposeful, non-default typography. Use a distinct display font for headers and a readable text font for body. Avoid system default stacks.
   - Light, atmospheric background (subtle gradient or pattern) and clear card surfaces.
   - Color-coded status chips with consistent legend.
   - Simple motion: page load fade + staggered list reveal.
   - Must look good on desktop and mobile.

Technical Plan

A) API Server (Bun)
- New entrypoint: src/dashboard/server.ts
- Uses Bun.serve() and serves both API and static UI build files.
- Reads from ~/.swarn/swarm.db with drizzle-orm + bun:sqlite in read-only mode.
- Adds CORS headers for local dev.

API endpoints
- GET /api/swarms
  - List of swarms with summary fields (id, status, tasks_total, tasks_completed, tasks_failed, iteration, max_iterations, tokens_in, tokens_out, cost, working_dir, created_at, updated_at).
- GET /api/swarms/:id
  - Full swarm record including plan + config JSON.
- GET /api/swarms/:id/tasks
  - Full task list with dependencies, status, claimed_by, result_summary, files_modified, error, iteration, judge_feedback, created_at, updated_at.

Implementation details
- Reuse existing schema from src/db/schema.ts.
- Add helper functions for mapping snake_case columns to camelCase API output.
- Static file serving for the UI build output under src/dashboard/ui/dist (or similar).

B) UI (SolidJS + Vite)
- New folder: src/dashboard/ui
- Vite + SolidJS SPA.
- Router with two routes: / (list) and /swarm/:id (detail).
- Shared components: StatusChip, StatCard, TaskRow, Toolbar.
- API client in src/dashboard/ui/src/lib/api.ts with typed response helpers.

UI layout
- List view: card table with row click navigation, status chips, progress bars.
- Detail view: top summary grid + task list with expandable rows.
- Show empty states with a clear call to action.

Design tokens
- Define CSS variables for color, spacing, and typography in src/dashboard/ui/src/styles.css.
- Use two web fonts via Google Fonts (example: Space Grotesk for headings, IBM Plex Sans for body). Include a mono font for code paths if needed (IBM Plex Mono).

C) Dev + Build
- Root package.json scripts:
  - dashboard: bun run src/dashboard/server.ts
  - dashboard:dev: run API server + Vite dev server with proxy to /api
  - dashboard:build: build UI and copy assets to the server static directory
- Vite dev server proxy to http://localhost:4747
- Default dashboard server port: 4747

Acceptance Criteria
- Running swarn creates DB entries that appear in the list view.
- Detail view shows accurate task statuses, dependencies, and results.
- UI updates automatically while swarms are running.
- Dashboard runs locally with one command and loads in a browser.
- SolidJS is used for the UI.

Notes
- Keep changes minimal and localized. Avoid touching core swarm execution logic.
- If the DB does not exist yet, show a friendly empty state.
