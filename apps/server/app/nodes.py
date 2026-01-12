from __future__ import annotations

import base64
import json
import multiprocessing
from dataclasses import dataclass
from typing import Any, Callable

import httpx

Items = list[dict[str, Any]]


@dataclass
class NodeDefinition:
    type: str
    label: str
    description: str
    params: list[dict[str, Any]]
    outputs: list[str] | None = None


NODE_DEFINITIONS = [
    NodeDefinition(
        type="manualTrigger",
        label="Manual Trigger",
        description="Starts a workflow manually.",
        params=[],
    ),
    NodeDefinition(
        type="cronTrigger",
        label="Cron Trigger",
        description="Schedule workflow execution with cron.",
        params=[
            {
                "name": "cronExpression",
                "type": "string",
                "required": True,
                "description": "Cron expression to trigger workflow.",
            }
        ],
    ),
    NodeDefinition(
        type="webhookTrigger",
        label="Webhook Trigger",
        description="Start workflow from an incoming webhook request.",
        params=[
            {
                "name": "path",
                "type": "string",
                "required": True,
                "description": "Webhook path (without /api/webhooks/ prefix).",
            },
            {
                "name": "method",
                "type": "string",
                "default": "POST",
                "description": "HTTP method.",
            },
        ],
    ),
    NodeDefinition(
        type="httpRequest",
        label="HTTP Request",
        description="Perform an HTTP request.",
        params=[
            {"name": "method", "type": "string", "default": "GET"},
            {"name": "url", "type": "string", "required": True},
            {"name": "headers", "type": "json"},
            {"name": "query", "type": "json"},
            {"name": "body", "type": "json"},
            {"name": "authType", "type": "string", "description": "basic or bearer"},
            {"name": "authUsername", "type": "string"},
            {"name": "authPassword", "type": "string"},
            {"name": "authToken", "type": "string"},
        ],
    ),
    NodeDefinition(
        type="code",
        label="Code",
        description="Run Python to transform items.",
        params=[
            {
                "name": "code",
                "type": "string",
                "required": True,
                "description": "Python: lambda items: items",
            }
        ],
    ),
    NodeDefinition(
        type="if",
        label="IF",
        description="Conditional branching.",
        outputs=["true", "false"],
        params=[
            {
                "name": "field",
                "type": "string",
                "required": True,
                "description": "Field to check (dot notation).",
            },
            {
                "name": "operator",
                "type": "string",
                "default": "equals",
                "description": "equals | notEquals | exists",
            },
            {"name": "value", "type": "string", "description": "Value to compare."},
        ],
    ),
    NodeDefinition(
        type="set",
        label="Set",
        description="Set or rename fields.",
        params=[{"name": "fields", "type": "json", "description": "Fields to set."}],
    ),
]


class NodeContext:
    def __init__(self) -> None:
        self.logs: list[str] = []

    def log(self, message: str) -> None:
        self.logs.append(message)


def _get_by_path(item: dict[str, Any], path: str) -> Any:
    if not path:
        return None
    current: Any = item
    for key in path.split("."):
        if isinstance(current, dict):
            current = current.get(key)
        else:
            return None
    return current


def _run_code(code: str, items: Items, result_queue: multiprocessing.Queue) -> None:
    def safe_print(*args: Any) -> None:
        result_queue.put({"type": "log", "value": " ".join(map(str, args))})

    safe_builtins = {"len": len, "range": range, "min": min, "max": max}
    local_vars: dict[str, Any] = {}
    try:
        fn = eval(code, {"__builtins__": safe_builtins, "print": safe_print})
        output = fn(items)
        result_queue.put({"type": "result", "value": output})
    except Exception as exc:  # noqa: BLE001
        result_queue.put({"type": "error", "value": str(exc)})


def _execute_code_node(code: str, items: Items, context: NodeContext) -> Items:
    result_queue: multiprocessing.Queue = multiprocessing.Queue()
    process = multiprocessing.Process(target=_run_code, args=(code, items, result_queue))
    process.start()
    process.join(timeout=2)
    if process.is_alive():
        process.terminate()
        process.join()
        raise RuntimeError("Code node timed out")

    output: Items | None = None
    while not result_queue.empty():
        message = result_queue.get()
        if message["type"] == "log":
            context.log(message["value"])
        if message["type"] == "error":
            raise RuntimeError(message["value"])
        if message["type"] == "result":
            output = message["value"]

    if not isinstance(output, list):
        raise RuntimeError("Code node must return a list of items")
    return output


NodeHandler = Callable[[dict[str, Any], Items, NodeContext], dict[str, Any]]


def handle_http_request(params: dict[str, Any], _items: Items, _ctx: NodeContext) -> dict[str, Any]:
    url = str(params.get("url") or "")
    if not url:
        raise ValueError("HTTP Request node requires url")
    method = str(params.get("method", "GET")).upper()
    headers = params.get("headers") or {}
    query = params.get("query") or {}
    body = params.get("body")

    if params.get("authType") == "basic":
        token = base64.b64encode(
            f"{params.get('authUsername', '')}:{params.get('authPassword', '')}".encode()
        ).decode()
        headers["Authorization"] = f"Basic {token}"
    if params.get("authType") == "bearer":
        headers["Authorization"] = f"Bearer {params.get('authToken', '')}"

    with httpx.Client() as client:
        response = client.request(method, url, headers=headers, params=query, json=body)

    return {
        "default": [
            {
                "status": response.status_code,
                "data": response.json() if response.content else None,
                "headers": dict(response.headers),
            }
        ]
    }


def handle_code(params: dict[str, Any], items: Items, ctx: NodeContext) -> dict[str, Any]:
    code = str(params.get("code") or "")
    if not code:
        raise ValueError("Code node requires code")
    output = _execute_code_node(code, items, ctx)
    return {"default": output, "logs": ctx.logs}


def handle_if(params: dict[str, Any], items: Items, _ctx: NodeContext) -> dict[str, Any]:
    field = str(params.get("field") or "")
    operator = str(params.get("operator") or "equals")
    value = params.get("value")
    truthy: Items = []
    falsy: Items = []
    for item in items:
        field_value = _get_by_path(item, field)
        if operator == "exists":
            result = field_value is not None
        elif operator == "notEquals":
            result = field_value != value
        else:
            result = field_value == value
        (truthy if result else falsy).append(item)
    return {"outputs": {"true": truthy, "false": falsy}}


def handle_set(params: dict[str, Any], items: Items, _ctx: NodeContext) -> dict[str, Any]:
    fields = params.get("fields") or {}
    return {"default": [{**item, **fields} for item in items]}


NODE_HANDLERS: dict[str, NodeHandler] = {
    "manualTrigger": lambda _p, items, _c: {"default": items},
    "cronTrigger": lambda _p, items, _c: {"default": items},
    "webhookTrigger": lambda _p, items, _c: {"default": items},
    "httpRequest": handle_http_request,
    "code": handle_code,
    "if": handle_if,
    "set": handle_set,
}


def serialize_node_definitions() -> list[dict[str, Any]]:
    return [
        {
            "type": node.type,
            "label": node.label,
            "description": node.description,
            "params": node.params,
            "outputs": node.outputs,
        }
        for node in NODE_DEFINITIONS
    ]
