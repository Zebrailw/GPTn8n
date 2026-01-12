from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    active: Mapped[bool] = mapped_column(Boolean, default=False)
    nodes_json: Mapped[str] = mapped_column(Text)
    edges_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    executions: Mapped[list["Execution"]] = relationship(
        "Execution", back_populates="workflow", cascade="all, delete-orphan"
    )
    webhooks: Mapped[list["WebhookEndpoint"]] = relationship(
        "WebhookEndpoint", back_populates="workflow", cascade="all, delete-orphan"
    )


class Execution(Base):
    __tablename__ = "executions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    workflow_id: Mapped[str] = mapped_column(String, ForeignKey("workflows.id"))
    status: Mapped[str] = mapped_column(String)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error: Mapped[str | None] = mapped_column(String, nullable=True)

    workflow: Mapped[Workflow] = relationship("Workflow", back_populates="executions")
    steps: Mapped[list["ExecutionStep"]] = relationship(
        "ExecutionStep", back_populates="execution", cascade="all, delete-orphan"
    )


class ExecutionStep(Base):
    __tablename__ = "execution_steps"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    execution_id: Mapped[str] = mapped_column(String, ForeignKey("executions.id"))
    node_id: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    input_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(String, nullable=True)

    execution: Mapped[Execution] = relationship("Execution", back_populates="steps")


class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    workflow_id: Mapped[str] = mapped_column(String, ForeignKey("workflows.id"))
    path: Mapped[str] = mapped_column(String)
    method: Mapped[str] = mapped_column(String)
    node_id: Mapped[str] = mapped_column(String)

    workflow: Mapped[Workflow] = relationship("Workflow", back_populates="webhooks")
