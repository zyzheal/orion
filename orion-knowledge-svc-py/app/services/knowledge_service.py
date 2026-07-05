"""Knowledge service - business logic for knowledge operations."""

from typing import Optional
from uuid import UUID, uuid4

from ..models.schemas import (
    CreateDocRequest,
    CreateSpaceRequest,
    DocVersion,
    KnowledgeDoc,
    KnowledgeSpace,
    PaginationParams,
    SearchRequest,
    SearchResult,
    UpdateDocRequest,
)


class KnowledgeService:
    """Service for managing knowledge spaces and documents."""

    def __init__(self):
        self._spaces: dict[UUID, KnowledgeSpace] = {}
        self._docs: dict[UUID, KnowledgeDoc] = {}
        self._versions: dict[UUID, list[DocVersion]] = {}

    def create_space(self, tenant_id: str, req: CreateSpaceRequest) -> KnowledgeSpace:
        space = KnowledgeSpace(
            id=uuid4(),
            tenant_id=tenant_id,
            name=req.name,
            description=req.description,
            type=req.type,
        )
        self._spaces[space.id] = space
        return space

    def get_space(self, space_id: UUID) -> Optional[KnowledgeSpace]:
        return self._spaces.get(space_id)

    def list_spaces(self, tenant_id: str, params: PaginationParams) -> list[KnowledgeSpace]:
        spaces = [s for s in self._spaces.values() if s.tenant_id == tenant_id]
        spaces.sort(key=lambda s: s.created_at, reverse=True)
        offset = (params.page - 1) * params.page_size
        return spaces[offset:offset + params.page_size]

    def create_doc(self, tenant_id: str, space_id: UUID, req: CreateDocRequest) -> KnowledgeDoc:
        space = self._spaces.get(space_id)
        if not space:
            raise ValueError(f"Space not found: {space_id}")

        doc = KnowledgeDoc(
            id=uuid4(),
            space_id=space_id,
            tenant_id=tenant_id,
            title=req.title,
            content=req.content,
            tags=req.tags,
        )
        self._docs[doc.id] = doc
        self._versions[doc.id] = [
            DocVersion(id=uuid4(), doc_id=doc.id, version=1, content=req.content)
        ]
        space.doc_count += 1
        return doc

    def get_doc(self, doc_id: UUID) -> Optional[KnowledgeDoc]:
        return self._docs.get(doc_id)

    def list_docs(self, space_id: UUID, params: PaginationParams) -> list[KnowledgeDoc]:
        docs = [d for d in self._docs.values() if d.space_id == space_id]
        docs.sort(key=lambda d: d.updated_at, reverse=True)
        offset = (params.page - 1) * params.page_size
        return docs[offset:offset + params.page_size]

    def update_doc(self, doc_id: UUID, req: UpdateDocRequest) -> KnowledgeDoc:
        doc = self._docs.get(doc_id)
        if not doc:
            raise ValueError(f"Document not found: {doc_id}")

        if req.title is not None:
            doc.title = req.title
        if req.content is not None:
            doc.content = req.content
            doc.version += 1
            self._versions[doc_id].append(
                DocVersion(id=uuid4(), doc_id=doc_id, version=doc.version, content=req.content)
            )
        if req.tags is not None:
            doc.tags = req.tags
        doc.updated_at = __import__("datetime").datetime.utcnow()
        return doc

    def delete_doc(self, doc_id: UUID) -> bool:
        doc = self._docs.pop(doc_id, None)
        if not doc:
            return False
        self._versions.pop(doc_id, None)
        space = self._spaces.get(doc.space_id)
        if space:
            space.doc_count = max(0, space.doc_count - 1)
        return True

    def search(self, tenant_id: str, req: SearchRequest) -> list[SearchResult]:
        results = []
        query_lower = req.query.lower()
        for doc in self._docs.values():
            if doc.tenant_id != tenant_id:
                continue
            if req.space_id and doc.space_id != req.space_id:
                continue
            if query_lower in doc.title.lower() or query_lower in doc.content.lower():
                snippet_start = doc.content.lower().find(query_lower)
                start = max(0, snippet_start - 50)
                end = min(len(doc.content), snippet_start + len(req.query) + 50)
                results.append(
                    SearchResult(
                        doc_id=doc.id,
                        title=doc.title,
                        snippet=doc.content[start:end],
                        score=1.0,
                        space_id=doc.space_id,
                    )
                )
        results.sort(key=lambda r: r.score, reverse=True)
        return results[:req.limit]

    def get_doc_versions(self, doc_id: UUID) -> list[DocVersion]:
        return self._versions.get(doc_id, [])
