# Personal Automation Builder (MVP)

Single-user workflow automation builder inspired by n8n. Build workflows visually, run them manually or on cron schedules, and inspect execution history.

## Stack

- Backend: Python 3.11 + FastAPI + SQLAlchemy + Alembic
- Scheduler: APScheduler
- Frontend: React + TypeScript + Vite + ReactFlow
- Database: SQLite
- Shared types: `/packages/shared`

## Project structure

```
/apps/server   # FastAPI API + runtime engine
/apps/web      # React UI
/packages/shared # Shared node definitions + types
```

## Quick start (Windows)

Run the one-click script from the repo root:

```
run.bat
```

This creates a virtualenv, installs backend deps, installs frontend deps, runs Alembic migrations, and starts the API + UI at `http://localhost:5173`.

## Setup (manual)

1. Copy env:

```
cp .env.example .env
```

2. Backend setup:

```
python -m venv .venv
.venv/Scripts/activate
pip install -r apps/server/requirements.txt
cd apps/server
alembic upgrade head
```

3. Start backend:

```
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

4. Start frontend (new terminal):

```
npm install
npm run dev:web
```

The API runs at `http://localhost:8000` and the web app at `http://localhost:5173`.

## Docker (dev)

```
docker-compose up --build
```

## API

- GET `/api/workflows`
- POST `/api/workflows`
- GET `/api/workflows/{id}`
- PUT `/api/workflows/{id}`
- DELETE `/api/workflows/{id}`
- POST `/api/workflows/{id}/run`
- GET `/api/executions?workflowId=...`
- GET `/api/executions/{id}`
- POST `/api/webhooks/{path}`

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
