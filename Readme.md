# Personal Automation Builder (MVP)

Single-user workflow automation builder inspired by n8n. Build workflows visually, run them manually or on cron schedules, and inspect execution history.

## Stack

- Frontend: React + TypeScript + Vite + ReactFlow
- Backend: Node.js + TypeScript + Fastify
- Database: SQLite + Prisma
- Scheduler: node-cron
- Shared types: `/packages/shared`

## Project structure

```
/apps/server   # Fastify API + runtime engine
/apps/web      # React UI
/packages/shared # Shared node definitions + types
```

## Quick start (Windows)

Run the one-click script from the repo root:

```
run.bat
```

This installs dependencies, runs Prisma migrations, starts the server and web app, and opens the app at `http://localhost:5173`.

## Setup (manual)

1. Copy env:

```
cp .env.example .env
```

2. Install dependencies and run database migration:

```
npm install
npm run -w @pab/server prisma:generate
npm run -w @pab/server prisma:migrate
```

3. Run server and web (separate terminals):

```
npm run dev:server
npm run dev:web
```

The API runs at `http://localhost:4000` and the web app at `http://localhost:5173`.

## Docker (dev)

```
docker-compose up --build
```

## API

- GET `/api/workflows`
- POST `/api/workflows`
- GET `/api/workflows/:id`
- PUT `/api/workflows/:id`
- DELETE `/api/workflows/:id`
- POST `/api/workflows/:id/run`
- GET `/api/executions?workflowId=...`
- GET `/api/executions/:id`
- POST `/api/webhooks/:path`

## Example workflow JSON

### 1) cron -> http -> set

```json
{
  "name": "cron-http-set",
  "active": true,
  "nodes": [
    {
      "id": "cron-1",
      "type": "cronTrigger",
      "position": { "x": 100, "y": 100 },
      "data": { "params": { "cronExpression": "*/5 * * * *" } }
    },
    {
      "id": "http-1",
      "type": "httpRequest",
      "position": { "x": 300, "y": 100 },
      "data": { "params": { "method": "GET", "url": "https://example.com" } }
    },
    {
      "id": "set-1",
      "type": "set",
      "position": { "x": 520, "y": 100 },
      "data": { "params": { "fields": { "source": "cron" } } }
    }
  ],
  "edges": [
    { "id": "e1", "source": "cron-1", "target": "http-1" },
    { "id": "e2", "source": "http-1", "target": "set-1" }
  ]
}
```

### 2) webhook -> if -> http

```json
{
  "name": "webhook-if-http",
  "active": true,
  "nodes": [
    {
      "id": "wh-1",
      "type": "webhookTrigger",
      "position": { "x": 100, "y": 100 },
      "data": { "params": { "path": "incoming", "method": "POST" } }
    },
    {
      "id": "if-1",
      "type": "if",
      "position": { "x": 300, "y": 100 },
      "data": { "params": { "field": "body.status", "operator": "equals", "value": "ok" } }
    },
    {
      "id": "http-1",
      "type": "httpRequest",
      "position": { "x": 520, "y": 60 },
      "data": { "params": { "method": "POST", "url": "https://example.com/webhook" } }
    }
  ],
  "edges": [
    { "id": "e1", "source": "wh-1", "target": "if-1" },
    { "id": "e2", "source": "if-1", "sourceHandle": "true", "target": "http-1" }
  ]
}
```
