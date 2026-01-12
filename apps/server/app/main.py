from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .db import Base, SessionLocal, engine
from .models import Execution, ExecutionStep, WebhookEndpoint, Workflow
from .nodes import serialize_node_definitions
from .runtime import execute_workflow
from .scheduler import reschedule_cron, shutdown_scheduler
from .schemas import (
    ExecutionDetailResponse,
    ExecutionResponse,
    ExecutionStepResponse,
    WorkflowCreate,
    WorkflowResponse,
)

logger = logging.getLogger("pab")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")


def workflow_to_dict(workflow: Workflow) -> dict[str, Any]:
    return {
        "id": workflow.id,
        "name": workflow.name,
        "active": workflow.active,
        "nodes": json.loads(workflow.nodes_json),
        "edges": json.loads(workflow.edges_json),
        "createdAt": workflow.created_at,
        "updatedAt": workflow.updated_at,
    }


def execution_to_response(execution: Execution) -> ExecutionResponse:
    return ExecutionResponse(
        id=execution.id,
        workflowId=execution.workflow_id,
        status=execution.status,
        startedAt=execution.started_at,
        finishedAt=execution.finished_at,
        error=execution.error,
    )


def step_to_response(step: ExecutionStep) -> ExecutionStepResponse:
    return ExecutionStepResponse(
        id=step.id,
        executionId=step.execution_id,
        nodeId=step.node_id,
        status=step.status,
        startedAt=step.started_at,
        finishedAt=step.finished_at,
        input=json.loads(step.input_json) if step.input_json else None,
        output=json.loads(step.output_json) if step.output_json else None,
        logs=json.loads(step.logs_json) if step.logs_json else None,
        error=step.error,
    )


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        reschedule(db)


@app.on_event("shutdown")
def shutdown() -> None:
    shutdown_scheduler()


@app.get("/api/nodes")
def list_nodes() -> dict[str, Any]:
    return {"nodes": serialize_node_definitions()}


@app.get("/api/workflows", response_model=list[WorkflowResponse])
def list_workflows() -> list[WorkflowResponse]:
    with SessionLocal() as db:
        workflows = db.query(Workflow).all()
        return [WorkflowResponse(**workflow_to_dict(wf)) for wf in workflows]


@app.post("/api/workflows", response_model=WorkflowResponse)
def create_workflow(payload: WorkflowCreate) -> WorkflowResponse:
    with SessionLocal() as db:
        workflow = Workflow(
            id=str(uuid.uuid4()),
            name=payload.name,
            active=payload.active,
            nodes_json=payload.nodes.model_dump_json(),
            edges_json=payload.edges.model_dump_json(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(workflow)
        db.commit()
        register_webhooks(db, workflow.id, payload.nodes)
        reschedule(db)
        return WorkflowResponse(**workflow_to_dict(workflow))


@app.get("/api/workflows/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(workflow_id: str) -> WorkflowResponse:
    with SessionLocal() as db:
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        return WorkflowResponse(**workflow_to_dict(workflow))


@app.put("/api/workflows/{workflow_id}", response_model=WorkflowResponse)
def update_workflow(workflow_id: str, payload: WorkflowCreate) -> WorkflowResponse:
    with SessionLocal() as db:
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        workflow.name = payload.name
        workflow.active = payload.active
        workflow.nodes_json = payload.nodes.model_dump_json()
        workflow.edges_json = payload.edges.model_dump_json()
        workflow.updated_at = datetime.utcnow()
        db.add(workflow)
        db.commit()
        register_webhooks(db, workflow.id, payload.nodes)
        reschedule(db)
        return WorkflowResponse(**workflow_to_dict(workflow))


@app.delete("/api/workflows/{workflow_id}")
def delete_workflow(workflow_id: str) -> dict[str, bool]:
    with SessionLocal() as db:
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        db.query(WebhookEndpoint).filter(WebhookEndpoint.workflow_id == workflow_id).delete()
        db.query(ExecutionStep).join(Execution).filter(Execution.workflow_id == workflow_id).delete()
        db.query(Execution).filter(Execution.workflow_id == workflow_id).delete()
        db.delete(workflow)
        db.commit()
        reschedule(db)
        return {"ok": True}


@app.post("/api/workflows/{workflow_id}/run")
def run_workflow(workflow_id: str) -> dict[str, str]:
    with SessionLocal() as db:
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        workflow_dict = workflow_to_dict(workflow)
        execution_id = execute_workflow(db, workflow_dict, [])
        return {"executionId": execution_id}


@app.get("/api/executions", response_model=list[ExecutionResponse])
def list_executions(workflowId: str | None = None) -> list[ExecutionResponse]:
    with SessionLocal() as db:
        query = db.query(Execution)
        if workflowId:
            query = query.filter(Execution.workflow_id == workflowId)
        executions = query.order_by(Execution.started_at.desc()).all()
        return [execution_to_response(execution) for execution in executions]


@app.get("/api/executions/{execution_id}", response_model=ExecutionDetailResponse)
def get_execution(execution_id: str) -> ExecutionDetailResponse:
    with SessionLocal() as db:
        execution = db.query(Execution).filter(Execution.id == execution_id).first()
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        steps = (
            db.query(ExecutionStep)
            .filter(ExecutionStep.execution_id == execution_id)
            .order_by(ExecutionStep.started_at.asc())
            .all()
        )
        return ExecutionDetailResponse(
            **execution_to_response(execution).model_dump(),
            steps=[step_to_response(step) for step in steps],
        )


@app.api_route("/api/webhooks/{path:path}", methods=["GET", "POST"])
async def webhook_handler(path: str, request: Request) -> dict[str, str]:
    with SessionLocal() as db:
        webhook = (
            db.query(WebhookEndpoint)
            .filter(WebhookEndpoint.path == path, WebhookEndpoint.method == request.method)
            .first()
        )
        if not webhook:
            raise HTTPException(status_code=404, detail="Webhook not found")
        workflow = db.query(Workflow).filter(Workflow.id == webhook.workflow_id).first()
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        body = None
        if "application/json" in (request.headers.get("content-type") or ""):
            body = await request.json()
        payload = {
            "body": body,
            "headers": dict(request.headers),
            "query": dict(request.query_params),
        }
        execution_id = execute_workflow(db, workflow_to_dict(workflow), [payload])
        return {"executionId": execution_id}


@app.get("/")
def serve_index() -> FileResponse:
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="Frontend build not found")
    return FileResponse(index_path)


def register_webhooks(db: Session, workflow_id: str, nodes: list[Any]) -> None:
    db.query(WebhookEndpoint).filter(WebhookEndpoint.workflow_id == workflow_id).delete()
    for node in nodes:
        if node.type != "webhookTrigger":
            continue
        params = node.data.get("params", {})
        path = str(params.get("path", "")).lstrip("/")
        if not path:
            continue
        webhook = WebhookEndpoint(
            id=str(uuid.uuid4()),
            workflow_id=workflow_id,
            path=path,
            method=str(params.get("method", "POST")).upper(),
            node_id=node.id,
        )
        db.add(webhook)
    db.commit()


def reschedule(db: Session) -> None:
    workflows = db.query(Workflow).all()
    reschedule_cron(SessionLocal, [workflow_to_dict(workflow) for workflow in workflows])
