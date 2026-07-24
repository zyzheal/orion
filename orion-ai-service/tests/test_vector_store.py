"""
VectorStore 服务测试

覆盖：
- 生成嵌入
- 批量嵌入
- 语义搜索
- upsert/delete/get CRUD
- 空搜索结果
"""

import math
from typing import List

import pytest

from src.models.vector_types import EmbeddingRecord, SearchResult
from src.services.vector_store import (
    CodeEmbeddingService,
    SemanticSearchService,
    VectorStore,
)


# ==================== Fixtures ====================


@pytest.fixture
def embedding_service() -> CodeEmbeddingService:
    return CodeEmbeddingService(dimension=128)


@pytest.fixture
def vector_store() -> VectorStore:
    return VectorStore()


@pytest.fixture
def sample_embeddings() -> List[List[float]]:
    """生成示例嵌入向量"""
    return [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
        [0.5, 0.5, 0.0],
        [0.5, 0.0, 0.5],
    ]


# ==================== CodeEmbeddingService 测试 ====================


class TestCodeEmbeddingService:
    """代码嵌入生成测试"""

    def test_generate_embedding_returns_list(self, embedding_service):
        embedding = embedding_service.generate_embedding("def foo(): pass")
        assert isinstance(embedding, list)
        assert len(embedding) == 128
        assert all(isinstance(v, float) for v in embedding)

    def test_generate_embedding_same_input_same_output(self, embedding_service):
        code = "class User:\n    def __init__(self, name):\n        self.name = name"
        emb1 = embedding_service.generate_embedding(code)
        emb2 = embedding_service.generate_embedding(code)
        assert emb1 == emb2

    def test_generate_embedding_different_input_different_output(self, embedding_service):
        # 使用明显不同的代码输入，确保嵌入有区分度
        emb1 = embedding_service.generate_embedding(
            "def fibonacci(n):\n    if n <= 1: return n\n    return fibonacci(n-1) + fibonacci(n-2)"
        )
        emb2 = embedding_service.generate_embedding(
            "SELECT u.id, u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id WHERE o.status = 'paid'"
        )
        # 不同代码应产生不同嵌入
        assert emb1 != emb2
        # 嵌入向量应具有单位范数（L2 归一化）
        norm1 = math.sqrt(sum(x * x for x in emb1))
        assert pytest.approx(norm1, abs=1e-6) == 1.0

    def test_generate_embedding_empty_string(self, embedding_service):
        embedding = embedding_service.generate_embedding("")
        assert len(embedding) == 128
        assert all(v == 0.0 for v in embedding)

    def test_generate_embedding_model_parameter(self, embedding_service):
        # model 参数为模拟参数，不应影响输出结构
        emb = embedding_service.generate_embedding("x = 1", model="custom-model")
        assert len(emb) == 128

    def test_generate_embeddings_batch_empty(self, embedding_service):
        result = embedding_service.generate_embeddings_batch([])
        assert result == []

    def test_generate_embeddings_batch_single(self, embedding_service):
        result = embedding_service.generate_embeddings_batch(["a = 1"])
        assert len(result) == 1
        assert len(result[0]) == 128

    def test_generate_embeddings_batch_multiple(self, embedding_service):
        codes = ["a = 1", "b = 2", "c = 3"]
        result = embedding_service.generate_embeddings_batch(codes)
        assert len(result) == 3
        for emb in result:
            assert len(emb) == 128

    def test_generate_embeddings_batch_consistent(self, embedding_service):
        codes = ["def foo(): pass", "def bar(): pass"]
        result = embedding_service.generate_embeddings_batch(codes)
        assert result[0] != result[1]


# ==================== SemanticSearchService 测试 ====================


class TestSemanticSearchService:
    """语义搜索测试"""

    def test_cosine_similarity_identical(self):
        a = [1.0, 0.0, 0.0]
        b = [1.0, 0.0, 0.0]
        assert SemanticSearchService.cosine_similarity(a, b) == pytest.approx(1.0)

    def test_cosine_similarity_orthogonal(self):
        a = [1.0, 0.0, 0.0]
        b = [0.0, 1.0, 0.0]
        assert SemanticSearchService.cosine_similarity(a, b) == pytest.approx(0.0)

    def test_cosine_similarity_opposite(self):
        a = [1.0, 0.0, 0.0]
        b = [-1.0, 0.0, 0.0]
        assert SemanticSearchService.cosine_similarity(a, b) == pytest.approx(-1.0)

    def test_cosine_similarity_partial(self):
        a = [0.5, 0.5, 0.0]
        b = [1.0, 0.0, 0.0]
        # dot = 0.5, norm_a = sqrt(0.5), norm_b = 1.0 -> cos = 0.5 / sqrt(0.5) = sqrt(0.5)
        expected = 0.5 / math.sqrt(0.5)
        assert SemanticSearchService.cosine_similarity(a, b) == pytest.approx(expected)

    def test_cosine_similarity_zero_vector(self):
        a = [0.0, 0.0, 0.0]
        b = [1.0, 0.0, 0.0]
        assert SemanticSearchService.cosine_similarity(a, b) == pytest.approx(0.0)

    def test_cosine_similarity_length_mismatch(self):
        a = [1.0, 0.0]
        b = [1.0, 0.0, 0.0]
        assert SemanticSearchService.cosine_similarity(a, b) == pytest.approx(0.0)

    def test_cosine_similarity_empty(self):
        assert SemanticSearchService.cosine_similarity([], []) == pytest.approx(0.0)

    def test_search_basic(self):
        records = [
            EmbeddingRecord(code_id="a", embedding=[1.0, 0.0, 0.0], metadata={}),
            EmbeddingRecord(code_id="b", embedding=[0.0, 1.0, 0.0], metadata={}),
        ]
        results = SemanticSearchService().search([1.0, 0.0, 0.0], records, top_k=2)
        assert len(results) == 2
        assert results[0].code_id == "a"
        assert results[0].similarity == pytest.approx(1.0)

    def test_search_top_k(self):
        # 使用非共线向量，确保相似度有区分度
        query = [1.0, 0.0, 0.0]
        records = [
            EmbeddingRecord(code_id=f"id_{i}", embedding=[float(i), 1.0, 0.0], metadata={})
            for i in range(1, 11)
        ]
        results = SemanticSearchService().search(query, records, top_k=3)
        assert len(results) == 3
        # i 越大越接近 query 方向，id_10 (i=10) 相似度最高
        assert results[0].code_id == "id_10"

    def test_search_sorted_by_similarity_descending(self):
        # 使用非共线向量，确保相似度有区分度
        query = [1.0, 0.0, 0.0]
        records = [
            EmbeddingRecord(code_id="low", embedding=[0.2, 1.0, 0.0], metadata={}),
            EmbeddingRecord(code_id="high", embedding=[1.0, 0.0, 0.0], metadata={}),
            EmbeddingRecord(code_id="mid", embedding=[0.6, 0.5, 0.0], metadata={}),
        ]
        results = SemanticSearchService().search(query, records, top_k=3)
        assert [r.code_id for r in results] == ["high", "mid", "low"]
        assert results[0].similarity >= results[1].similarity >= results[2].similarity

    def test_search_includes_metadata(self):
        records = [
            EmbeddingRecord(
                code_id="func1",
                embedding=[1.0, 0.0],
                metadata={"language": "python", "file": "main.py"},
            ),
        ]
        results = SemanticSearchService().search([1.0, 0.0], records, top_k=1)
        assert results[0].metadata == {"language": "python", "file": "main.py"}

    def test_search_empty_query_embedding(self):
        records = [
            EmbeddingRecord(code_id="a", embedding=[1.0, 0.0], metadata={}),
        ]
        results = SemanticSearchService().search([], records, top_k=5)
        assert results == []

    def test_search_empty_records(self):
        results = SemanticSearchService().search([1.0, 0.0], [], top_k=5)
        assert results == []

    def test_search_top_k_larger_than_records(self):
        records = [
            EmbeddingRecord(code_id="a", embedding=[1.0, 0.0], metadata={}),
        ]
        results = SemanticSearchService().search([1.0, 0.0], records, top_k=10)
        assert len(results) == 1


# ==================== VectorStore CRUD 测试 ====================


class TestVectorStoreCRUD:
    """向量存储 CRUD 测试"""

    def test_upsert_embedding(self, vector_store):
        vector_store.upsert_embedding("code_1", [0.1, 0.2, 0.3], {"lang": "python"})
        assert vector_store.count() == 1

    def test_upsert_embedding_overwrites(self, vector_store):
        vector_store.upsert_embedding("code_1", [0.1, 0.2, 0.3])
        vector_store.upsert_embedding("code_1", [0.4, 0.5, 0.6])
        assert vector_store.count() == 1
        record = vector_store.get_embedding("code_1")
        assert record["embedding"] == [0.4, 0.5, 0.6]

    def test_get_embedding_exists(self, vector_store):
        vector_store.upsert_embedding("code_1", [0.1, 0.2, 0.3], {"lang": "go"})
        record = vector_store.get_embedding("code_1")
        assert record is not None
        assert record["code_id"] == "code_1"
        assert record["embedding"] == [0.1, 0.2, 0.3]
        assert record["metadata"] == {"lang": "go"}

    def test_get_embedding_not_found(self, vector_store):
        record = vector_store.get_embedding("nonexistent")
        assert record is None

    def test_delete_embedding(self, vector_store):
        vector_store.upsert_embedding("code_1", [0.1, 0.2, 0.3])
        vector_store.delete_embedding("code_1")
        assert vector_store.count() == 0
        assert vector_store.get_embedding("code_1") is None

    def test_delete_nonexistent_embedding(self, vector_store):
        # 不应抛异常
        vector_store.delete_embedding("nonexistent")
        assert vector_store.count() == 0

    def test_upsert_multiple(self, vector_store):
        for i in range(5):
            vector_store.upsert_embedding(f"code_{i}", [float(i)] * 3)
        assert vector_store.count() == 5
        for i in range(5):
            assert vector_store.get_embedding(f"code_{i}") is not None

    def test_list_all(self, vector_store):
        vector_store.upsert_embedding("a", [1.0, 0.0])
        vector_store.upsert_embedding("b", [0.0, 1.0])
        all_records = vector_store.list_all()
        assert len(all_records) == 2
        code_ids = {r.code_id for r in all_records}
        assert code_ids == {"a", "b"}

    def test_search_after_upsert(self, vector_store):
        vector_store.upsert_embedding("target", [1.0, 0.0, 0.0])
        vector_store.upsert_embedding("other", [0.0, 1.0, 0.0])
        results = vector_store.search([1.0, 0.0, 0.0], top_k=1)
        assert len(results) == 1
        assert results[0].code_id == "target"
        assert results[0].similarity == pytest.approx(1.0)

    def test_search_empty_store(self, vector_store):
        results = vector_store.search([1.0, 0.0, 0.0], top_k=5)
        assert results == []


# ==================== 端到端集成测试 ====================


class TestVectorStoreEndToEnd:
    """端到端集成测试"""

    def test_full_pipeline(self, vector_store, embedding_service):
        """完整流程：生成嵌入 -> 存储 -> 搜索"""
        codes = [
            "def calculate_sum(a, b): return a + b",
            "class DatabaseConnector:\n    def connect(self): pass",
            "SELECT * FROM users WHERE id = 1",
        ]

        # 使用 batch 模式统一生成嵌入，避免 single/batch 模式下 vocab 差异
        embeddings = embedding_service.generate_embeddings_batch(codes)
        for code_id, (code, emb) in enumerate(zip(codes, embeddings)):
            vector_store.upsert_embedding(
                code_id=str(code_id),
                embedding=emb,
                metadata={"code_preview": code[:50]},
            )

        # 使用 batch 模式生成查询嵌入（与存储使用同一 vocab 基线）
        query_emb = embedding_service.generate_embeddings_batch([codes[0]])[0]
        results = vector_store.search(query_emb, top_k=2)

        assert len(results) == 2
        assert results[0].code_id == "0"
        # batch 模式下同一文本的嵌入余弦相似度接近 1.0（允许浮点误差）
        assert results[0].similarity == pytest.approx(1.0, abs=0.01)
        assert "code_preview" in results[0].metadata
