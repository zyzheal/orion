"""SQLAlchemy models."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class LLMTrace(Base):
    """LLM request trace record."""

    __tablename__ = "llm_traces"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), nullable=False)
    trace_id = Column(String(64), nullable=True)
    model = Column(String(100), nullable=True)
    prompt = Column(Text, nullable=True)
    response = Column(Text, nullable=True)
    tokens_used = Column(Integer, nullable=True)
    cost = Column(Numeric(10, 4), nullable=True)
    status = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_traces_tenant", "tenant_id"),
        Index("idx_traces_trace_id", "trace_id"),
        Index("idx_traces_model", "model"),
        Index("idx_traces_created_at", "created_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "tenant_id": str(self.tenant_id),
            "trace_id": self.trace_id,
            "model": self.model,
            "prompt": self.prompt,
            "response": self.response,
            "tokens_used": self.tokens_used,
            "cost": float(self.cost) if self.cost else None,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
