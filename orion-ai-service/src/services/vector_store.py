"""
VectorStore 服务

提供代码嵌入生成、语义搜索和向量存储 CRUD 功能。
使用内存存储，可后续切换 PostgreSQL + pgvector。
"""

import hashlib
import logging
import math
import re
from collections import Counter
from typing import Any, Dict, List, Optional

from src.models.vector_types import EmbeddingRecord, SearchResult

logger = logging.getLogger(__name__)

# 停用词（简化版）
_STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "out", "off", "over",
    "under", "again", "further", "then", "once", "here", "there", "when",
    "where", "why", "how", "all", "each", "every", "both", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "just", "because", "but", "and",
    "or", "if", "while", "about", "up", "it", "its", "this", "that",
    "these", "those", "i", "me", "my", "we", "our", "you", "your", "he",
    "him", "his", "she", "her", "they", "them", "their", "what", "which",
    "who", "whom",
}

# 代码 token 分隔正则
_CODE_TOKEN_PATTERN = re.compile(r"[a-zA-Z_]\w+|[\d\.]+|==|!=|<=|>=|->|::|[{}()\[\];,.+=*/\\-]")


class CodeEmbeddingService:
    """代码嵌入生成服务

    使用 TF-IDF + 哈希模拟嵌入，不依赖外部 heavy 依赖。
    输出固定维度向量 (默认 128 维)。
    """

    def __init__(self, dimension: int = 128):
        self.dimension = dimension

    def _tokenize(self, text: str) -> List[str]:
        """分词：先按空白拆分，再按代码 token 模式拆分"""
        tokens: List[str] = []
        for line in text.split():
            # 对每行，先用代码 token 模式拆分
            code_tokens = _CODE_TOKEN_PATTERN.findall(line)
            if code_tokens:
                tokens.extend(code_tokens)
            else:
                # 回退到空白分词
                tokens.extend(line.lower().split())
        return tokens

    def _build_vocab(self, documents: List[str]) -> Dict[str, int]:
        """构建词汇表"""
        vocab: Dict[str, int] = {}
        for doc in documents:
            tokens = self._tokenize(doc)
            for token in tokens:
                if token not in vocab:
                    vocab[token] = len(vocab)
        return vocab

    def _compute_tfidf(
        self, documents: List[str], vocab: Dict[str, int]
    ) -> List[List[float]]:
        """计算 TF-IDF 矩阵"""
        doc_count = len(documents)
        if doc_count == 0:
            return []

        # 计算文档频率
        doc_freq: Dict[str, int] = {}
        for doc in documents:
            unique_tokens = set(self._tokenize(doc))
            for token in unique_tokens:
                doc_freq[token] = doc_freq.get(token, 0) + 1

        tfidf_matrix: List[List[float]] = []
        for doc in documents:
            tokens = self._tokenize(doc)
            if not tokens:
                tfidf_matrix.append([0.0] * len(vocab))
                continue

            token_counts = Counter(tokens)
            total_tokens = len(tokens)
            vector = [0.0] * len(vocab)
            for token, count in token_counts.items():
                if token in vocab:
                    idx = vocab[token]
                    tf = count / total_tokens
                    idf = math.log((1 + doc_count) / (1 + doc_freq.get(token, 0))) + 1
                    vector[idx] = tf * idf
            tfidf_matrix.append(vector)

        return tfidf_matrix

    def _hash_to_embedding(self, tfidf_vector: List[float]) -> List[float]:
        """将 TF-IDF 向量映射到固定维度嵌入向量"""
        if not tfidf_vector:
            return [0.0] * self.dimension

        # 使用确定性哈希将每个 TF-IDF 维度映射到 embedding 维度
        embedding = [0.0] * self.dimension
        for i, value in enumerate(tfidf_vector):
            if value == 0.0:
                continue
            # 将 TF-IDF 维度哈希到 embedding 维度
            h = hashlib.md5(f"dim_{i}".encode()).hexdigest()
            target_idx = int(h, 16) % self.dimension
            embedding[target_idx] += value

        # L2 归一化
        norm = math.sqrt(sum(x * x for x in embedding))
        if norm > 0:
            embedding = [x / norm for x in embedding]

        return embedding

    def generate_embedding(
        self, code: str, model: str = "text-embedding-ada-002"
    ) -> List[float]:
        """生成单个代码嵌入

        Args:
            code: 代码文本
            model: 模型名称（模拟参数，当前实现统一使用 TF-IDF + 哈希）

        Returns:
            List[float]: 嵌入向量
        """
        logger.debug("Generating embedding for code (model=%s, len=%d)", model, len(code))
        vocab = self._build_vocab([code])
        tfidf = self._compute_tfidf([code], vocab)
        if not tfidf:
            return [0.0] * self.dimension
        return self._hash_to_embedding(tfidf[0])

    def generate_embeddings_batch(
        self, codes: List[str], model: str = "text-embedding-ada-002"
    ) -> List[List[float]]:
        """批量生成代码嵌入

        Args:
            codes: 代码文本列表
            model: 模型名称

        Returns:
            List[List[float]]: 嵌入向量列表
        """
        if not codes:
            return []

        logger.debug("Generating batch embeddings (count=%d, model=%s)", len(codes), model)
        vocab = self._build_vocab(codes)
        tfidf_matrix = self._compute_tfidf(codes, vocab)
        return [self._hash_to_embedding(v) for v in tfidf_matrix]


class SemanticSearchService:
    """语义搜索服务"""

    @staticmethod
    def cosine_similarity(a: List[float], b: List[float]) -> float:
        """计算余弦相似度"""
        if len(a) != len(b) or not a:
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return dot / (norm_a * norm_b)

    def search(
        self,
        query_embedding: List[float],
        records: List[EmbeddingRecord],
        top_k: int = 10,
    ) -> List[SearchResult]:
        """语义搜索

        Args:
            query_embedding: 查询向量
            records: 候选嵌入记录列表
            top_k: 返回前 k 个结果

        Returns:
            List[SearchResult]: 搜索结果，按相似度降序
        """
        if not query_embedding or not records:
            return []

        scored: List[SearchResult] = []
        for record in records:
            sim = self.cosine_similarity(query_embedding, record.embedding)
            scored.append(SearchResult(
                code_id=record.code_id,
                similarity=sim,
                metadata=record.metadata,
            ))

        scored.sort(key=lambda r: r.similarity, reverse=True)
        return scored[:top_k]


class VectorStore:
    """向量存储服务

    提供 upsert/delete/get CRUD 操作，当前使用内存存储。
    可后续切换 PostgreSQL + pgvector 实现。
    """

    def __init__(self, embedding_service: Optional[CodeEmbeddingService] = None):
        self._store: Dict[str, EmbeddingRecord] = {}
        self._embedding_service = embedding_service or CodeEmbeddingService()

    def upsert_embedding(
        self,
        code_id: str,
        embedding: List[float],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """插入或更新嵌入记录

        Args:
            code_id: 代码片段唯一标识
            embedding: 嵌入向量
            metadata: 附加元数据
        """
        record = EmbeddingRecord(
            code_id=code_id,
            embedding=list(embedding),
            metadata=metadata or {},
        )
        self._store[code_id] = record
        logger.debug("Upserted embedding for code_id=%s", code_id)

    def delete_embedding(self, code_id: str) -> None:
        """删除嵌入记录

        Args:
            code_id: 代码片段唯一标识
        """
        if code_id in self._store:
            del self._store[code_id]
            logger.debug("Deleted embedding for code_id=%s", code_id)
        else:
            logger.warning("Attempted to delete nonexistent embedding: code_id=%s", code_id)

    def get_embedding(self, code_id: str) -> Optional[Dict[str, Any]]:
        """获取嵌入记录

        Args:
            code_id: 代码片段唯一标识

        Returns:
            Optional[Dict]: 嵌入记录字典，不存在时返回 None
        """
        record = self._store.get(code_id)
        if record is None:
            return None
        return record.model_dump()

    def list_all(self) -> List[EmbeddingRecord]:
        """列出所有嵌入记录"""
        return list(self._store.values())

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 10,
    ) -> List[SearchResult]:
        """语义搜索（便捷方法，直接使用内存数据）

        Args:
            query_embedding: 查询向量
            top_k: 返回前 k 个结果

        Returns:
            List[SearchResult]: 搜索结果
        """
        service = SemanticSearchService()
        return service.search(query_embedding, self.list_all(), top_k=top_k)

    def count(self) -> int:
        """返回存储的嵌入记录数"""
        return len(self._store)
