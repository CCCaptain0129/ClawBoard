# OpenClaw Visualization

## What It Is
- A local web app for monitoring OpenClaw agents and managing project tasks in a kanban board.
- It combines live agent updates, JSON-backed task operations, and Markdown sync utilities in one workspace.

## Who It's For
- Primary user/persona: OpenClaw operators and project managers who need a live view of agent activity and project task status.

## What It Does
- Shows agent cards with status, model, channel, token usage, and recent activity.
- Loads agent data by REST and refreshes it through a local WebSocket feed.
- Displays tasks in `todo`, `in-progress`, and `done` kanban columns.
- Creates, updates, and deletes JSON-backed tasks through backend APIs.
- Switches between projects and computes project progress summaries.
- Syncs task data between Markdown task docs and `tasks/*.json`.
- Watches task and subagent-related files, then broadcasts task updates to connected clients.

## How It Works
- Frontend: React 18 + Vite app with two main views, `Dashboard` and `KanbanBoard`; uses `fetch` plus a browser WebSocket client.
- Backend: Express server on port `3000` exposes agents, tasks, sync, task-doc, file-watcher, sync-lock, and health endpoints; a separate WebSocket server on port `3001` broadcasts `AGENTS_UPDATE` and `TASK_UPDATE`.
- Data/services: `AgentService` reads OpenClaw gateway or session data; `TaskService` reads and writes `tasks/<project>-tasks.json`; sync services convert Markdown to JSON and generate progress docs.
- Flow: startup sync loads `tasks/openclaw-visualization-TASKS.md` into JSON, UI mutations persist back to JSON, and watcher/sync services can update docs and task states from file changes.
- External services: OpenClaw Gateway config is required; Feishu group-name lookup is optional. Database: Not found in repo.

## How To Run
1. Install Node.js 18+ and npm, then run `./install.sh` from the repo root.
2. Set `OPENCLAW_GATEWAY_TOKEN` or create `src/backend/config/openclaw.json` from the example file; Feishu config is optional.
3. Start with `./start.sh`, then open the frontend on the Vite port reported by the script, typically `http://localhost:5173`; backend health check is `http://localhost:3000/health`.
