from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from .models import Execution, ExecutionStep
from .nodes import NODE_HANDLERS, NodeContext, Items


def execute_workflow(
    db: Session,
    workflow: dict[str, Any],
    initial_items: Items,
) -> str:
    execution = Execution(
        id=str(uuid.uuid4()),
        workflow_id=workflow["id"],
        status="running",
        started_at=datetime.utcnow(),
    )
    db.add(execution)
    db.commit()

    nodes = {node["id"]: node for node in workflow["nodes"]}
    edges = workflow["edges"]
    adjacency: dict[str, list[dict[str, Any]]] = {}
    for edge in edges:
        adjacency.setdefault(edge["source"], []).append(edge)

    trigger_nodes = [
        node
        for node in workflow["nodes"]
        if node["type"] in {"manualTrigger", "cronTrigger", "webhookTrigger"}
    ]
    if not trigger_nodes:
        raise RuntimeError("Workflow has no trigger node")

    queue: list[str] = []
    items_by_node: dict[str, Items] = {}
    for node in trigger_nodes:
        queue.append(node["id"])
        items_by_node[node["id"]] = initial_items

    try:
        while queue:
            node_id = queue.pop(0)
            node = nodes.get(node_id)
            if not node:
                continue
            handler = NODE_HANDLERS.get(node["type"])
            if not handler:
                raise RuntimeError(f"No handler for node type {node['type']}")

            items = items_by_node.get(node_id, [])
            step = ExecutionStep(
                id=str(uuid.uuid4()),
                execution_id=execution.id,
                node_id=node_id,
                status="running",
                started_at=datetime.utcnow(),
                input_json=json.dumps(items),
            )
            db.add(step)
            db.commit()

            ctx = NodeContext(execution.id, node_id)
            result = handler(node.get("data", {}).get("params", {}), items, ctx)
            outputs = result.get("outputs")
            output_default = result.get("default", [])

            step.status = "success"
            step.finished_at = datetime.utcnow()
            step.output_json = json.dumps(outputs or output_default)
            step.logs_json = json.dumps(ctx.logs) if ctx.logs else None
            db.add(step)
            db.commit()

            outgoing = adjacency.get(node_id, [])
            if outputs:
                for edge in outgoing:
                    handle = edge.get("sourceHandle") or "default"
                    items_for_edge = outputs.get(handle, [])
                    items_by_node.setdefault(edge["target"], []).extend(items_for_edge)
                    queue.append(edge["target"])
            else:
                for edge in outgoing:
                    items_by_node.setdefault(edge["target"], []).extend(output_default)
                    queue.append(edge["target"])

        execution.status = "success"
        execution.finished_at = datetime.utcnow()
        db.add(execution)
        db.commit()
    except Exception as exc:  # noqa: BLE001
        execution.status = "failed"
        execution.error = str(exc)
        execution.finished_at = datetime.utcnow()
        db.add(execution)
        db.commit()
        raise

    return execution.id
