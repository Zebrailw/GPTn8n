from datetime import datetime
from pydantic import BaseModel, Field


class NodePosition(BaseModel):
    x: float
    y: float


class WorkflowNode(BaseModel):
    id: str
    type: str
    position: NodePosition
    data: dict = Field(default_factory=dict)


class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: str | None = None
    targetHandle: str | None = None


class WorkflowCreate(BaseModel):
    name: str
    active: bool = False
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]


class WorkflowResponse(WorkflowCreate):
    id: str
    createdAt: datetime
    updatedAt: datetime


class ExecutionResponse(BaseModel):
    id: str
    workflowId: str
    status: str
    startedAt: datetime
    finishedAt: datetime | None = None
    error: str | None = None


class ExecutionStepResponse(BaseModel):
    id: str
    executionId: str
    nodeId: str
    status: str
    startedAt: datetime
    finishedAt: datetime | None = None
    input: dict | list | None = None
    output: dict | list | None = None
    error: str | None = None


class ExecutionDetailResponse(ExecutionResponse):
    steps: list[ExecutionStepResponse]
