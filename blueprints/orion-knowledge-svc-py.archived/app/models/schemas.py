"""Knowledge domain models."""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class SpaceType(str, Enum):
    GENERAL = "general"
    API = "api"
    RUNBOOK = "runbook"
    FAQ = "faq"


class KnowledgeSpace(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    tenant_id: str
    name: str
    description: str = ""
    type: SpaceType = SpaceType.GENERAL
    doc_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class KnowledgeDoc(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    space_id: UUID
    tenant_id: str
    title: str
    content: str = ""
    tags: list[str] = Field(default_factory=list)
    version: int = 1
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DocVersion(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    doc_id: UUID
    version: int
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SearchResult(BaseModel):
    doc_id: UUID
    title: str
    snippet: str
    score: float
    space_id: UUID


class CreateSpaceRequest(BaseModel):
    name: str
    description: str = ""
    type: SpaceType = SpaceType.GENERAL


class CreateDocRequest(BaseModel):
    title: str
    content: str = ""
    tags: list[str] = Field(default_factory=list)


class UpdateDocRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[list[str]] = None


class SearchRequest(BaseModel):
    query: str
    space_id: Optional[UUID] = None
    limit: int = 10


class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 20
