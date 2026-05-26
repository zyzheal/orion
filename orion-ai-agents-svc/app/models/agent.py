"""SQLAlchemy models."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Agent(Base):
    """AI Agent definition."""

    __tablename__ = "agents"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    config = Column(JSONB, nullable=True)
    status = Column(String(50), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    executions = relationship("AgentExecution", back_populates="agent", lazy="select")

    __table_args__ = (
        Index("idx_agents_tenant", "tenant_id"),
        Index("idx_agents_status", "status"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "tenant_id": str(self.tenant_id),
            "name": self.name,
            "description": self.description,
            "config": self.config or {},
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class AgentExecution(Base):
    """Agent execution record."""

    __tablename__ = "agent_executions"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    agent_id = Column(PG_UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    input = Column(Text, nullable=True)
    output = Column(Text, nullable=True)
    status = Column(String(50), default="pending")
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    agent = relationship("Agent", back_populates="executions")

    __table_args__ = (
        Index("idx_executions_agent", "agent_id"),
        Index("idx_executions_status", "status"),
        Index("idx_executions_started_at", "started_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "agent_id": str(self.agent_id),
            "input": self.input,
            "output": self.output,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
