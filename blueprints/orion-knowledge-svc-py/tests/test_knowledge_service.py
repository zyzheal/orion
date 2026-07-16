"""Tests for knowledge service."""

import pytest
from app.models.schemas import (
    CreateDocRequest,
    CreateSpaceRequest,
    PaginationParams,
    SearchRequest,
    SpaceType,
    UpdateDocRequest,
)
from app.services.knowledge_service import KnowledgeService


@pytest.fixture
def service():
    return KnowledgeService()


def test_create_space(service):
    req = CreateSpaceRequest(name="API Docs", type=SpaceType.API)
    space = service.create_space("t1", req)
    assert space.name == "API Docs"
    assert space.type == SpaceType.API
    assert space.tenant_id == "t1"


def test_create_doc(service):
    space_req = CreateSpaceRequest(name="Test Space")
    space = service.create_space("t1", space_req)

    doc_req = CreateDocRequest(title="Getting Started", content="Hello world")
    doc = service.create_doc("t1", space.id, doc_req)
    assert doc.title == "Getting Started"
    assert doc.version == 1
    assert doc.space_id == space.id


def test_update_doc(service):
    space = service.create_space("t1", CreateSpaceRequest(name="Test"))
    doc = service.create_doc("t1", space.id, CreateDocRequest(title="Doc", content="v1"))

    updated = service.update_doc(doc.id, UpdateDocRequest(content="v2"))
    assert updated.version == 2
    assert updated.content == "v2"


def test_delete_doc(service):
    space = service.create_space("t1", CreateSpaceRequest(name="Test"))
    doc = service.create_doc("t1", space.id, CreateDocRequest(title="Doc"))

    assert service.delete_doc(doc.id) is True
    assert service.get_doc(doc.id) is None
    assert space.doc_count == 0


def test_search(service):
    space = service.create_space("t1", CreateSpaceRequest(name="Test"))
    service.create_doc("t1", space.id, CreateDocRequest(title="API Guide", content="REST API documentation"))
    service.create_doc("t1", space.id, CreateDocRequest(title="Deployment", content="K8s deployment guide"))

    results = service.search("t1", SearchRequest(query="API"))
    assert len(results) == 1
    assert results[0].title == "API Guide"


def test_doc_versions(service):
    space = service.create_space("t1", CreateSpaceRequest(name="Test"))
    doc = service.create_doc("t1", space.id, CreateDocRequest(title="Doc", content="v1"))
    service.update_doc(doc.id, UpdateDocRequest(content="v2"))
    service.update_doc(doc.id, UpdateDocRequest(content="v3"))

    versions = service.get_doc_versions(doc.id)
    assert len(versions) == 3
    assert versions[-1].version == 3
