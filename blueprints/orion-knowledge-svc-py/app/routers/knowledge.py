"""Knowledge API routes."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

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
from ..services.knowledge_service import KnowledgeService

router = APIRouter(prefix="/api/v1/knowledge", tags=["knowledge"])
service = KnowledgeService()


# Space endpoints
@router.post("/spaces", status_code=201, response_model=KnowledgeSpace)
async def create_space(req: CreateSpaceRequest, tenant_id: str = "default"):
    return service.create_space(tenant_id, req)


@router.get("/spaces", response_model=list[KnowledgeSpace])
async def list_spaces(
    tenant_id: str = "default",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    return service.list_spaces(tenant_id, PaginationParams(page=page, page_size=page_size))


@router.get("/spaces/{space_id}", response_model=KnowledgeSpace)
async def get_space(space_id: UUID):
    space = service.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="space not found")
    return space


# Document endpoints
@router.post("/spaces/{space_id}/docs", status_code=201, response_model=KnowledgeDoc)
async def create_doc(space_id: UUID, req: CreateDocRequest, tenant_id: str = "default"):
    try:
        return service.create_doc(tenant_id, space_id, req)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/spaces/{space_id}/docs", response_model=list[KnowledgeDoc])
async def list_docs(
    space_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    return service.list_docs(space_id, PaginationParams(page=page, page_size=page_size))


@router.get("/docs/{doc_id}", response_model=KnowledgeDoc)
async def get_doc(doc_id: UUID):
    doc = service.get_doc(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="document not found")
    return doc


@router.put("/docs/{doc_id}", response_model=KnowledgeDoc)
async def update_doc(doc_id: UUID, req: UpdateDocRequest):
    try:
        return service.update_doc(doc_id, req)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/docs/{doc_id}", status_code=204)
async def delete_doc(doc_id: UUID):
    if not service.delete_doc(doc_id):
        raise HTTPException(status_code=404, detail="document not found")


@router.get("/docs/{doc_id}/versions", response_model=list[DocVersion])
async def get_doc_versions(doc_id: UUID):
    return service.get_doc_versions(doc_id)


# Search endpoint
@router.post("/search", response_model=list[SearchResult])
async def search(req: SearchRequest, tenant_id: str = "default"):
    return service.search(tenant_id, req)
