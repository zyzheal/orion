"""
AI 结果仓储层

使用 PostgreSQL 持久化 AI 分析、审查、决策等结果。
"""

import json
import logging
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import psycopg2
import psycopg2.extras
from psycopg2 import pool

logger = logging.getLogger(__name__)

# 默认数据库连接字符串（环境变量 ORION_AI_DATABASE_URL）
_DEFAULT_DSN = os.environ.get(
    "ORION_AI_DATABASE_URL",
    "postgresql://orion:orion@localhost:5432/orion",
)


class AIResultRepository:
    """AI 分析/审查/决策结果仓储（PostgreSQL）"""

    def __init__(self, dsn: Optional[str] = None, minconn: int = 1, maxconn: int = 5):
        self._dsn = dsn or _DEFAULT_DSN
        self._pool: Optional[pool.SimpleConnectionPool] = None
        self._minconn = minconn
        self._maxconn = maxconn
        self._tables_ensured = False

    def _get_pool(self) -> pool.SimpleConnectionPool:
        if self._pool is None:
            self._pool = pool.SimpleConnectionPool(
                self._minconn, self._maxconn, self._dsn
            )
        return self._pool

    def _ensure_tables_if_needed(self) -> None:
        if self._tables_ensured:
            return
        conn = self._get_pool().getconn()
        try:
            with conn.cursor() as cur:
                statements = [
                    """
                    CREATE TABLE IF NOT EXISTS ai_generations (
                        id TEXT PRIMARY KEY,
                        prompt TEXT NOT NULL,
                        context JSONB,
                        model TEXT,
                        content TEXT NOT NULL,
                        tokens_used INTEGER DEFAULT 0,
                        tenant_id TEXT NOT NULL DEFAULT 'default',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """,
                    """
                    CREATE TABLE IF NOT EXISTS ai_analyses (
                        id TEXT PRIMARY KEY,
                        type TEXT NOT NULL,
                        data JSONB NOT NULL DEFAULT '{}',
                        result JSONB NOT NULL DEFAULT '{}',
                        confidence REAL NOT NULL DEFAULT 0.0,
                        tenant_id TEXT NOT NULL DEFAULT 'default',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """,
                    """
                    CREATE TABLE IF NOT EXISTS ai_diagnoses (
                        id TEXT PRIMARY KEY,
                        symptoms JSONB NOT NULL DEFAULT '[]',
                        context JSONB,
                        diagnosis TEXT NOT NULL,
                        severity TEXT NOT NULL,
                        recommendations JSONB NOT NULL DEFAULT '[]',
                        tenant_id TEXT NOT NULL DEFAULT 'default',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """,
                    """
                    CREATE TABLE IF NOT EXISTS ai_decisions (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        description TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'pending',
                        recommendation TEXT,
                        confidence REAL DEFAULT 0.0,
                        context JSONB,
                        options JSONB,
                        tenant_id TEXT NOT NULL DEFAULT 'default',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ
                    )
                    """,
                    """
                    CREATE TABLE IF NOT EXISTS ai_reviews (
                        id TEXT PRIMARY KEY,
                        code TEXT NOT NULL,
                        language TEXT NOT NULL,
                        context JSONB,
                        reviewers JSONB,
                        status TEXT NOT NULL DEFAULT 'pending',
                        summary TEXT,
                        comments JSONB NOT NULL DEFAULT '[]',
                        score REAL DEFAULT 0.0,
                        tenant_id TEXT NOT NULL DEFAULT 'default',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        completed_at TIMESTAMPTZ
                    )
                    """,
                    "CREATE INDEX IF NOT EXISTS idx_ai_analyses_type_tenant ON ai_analyses(type, tenant_id)",
                    "CREATE INDEX IF NOT EXISTS idx_ai_decisions_status_tenant ON ai_decisions(status, tenant_id)",
                    "CREATE INDEX IF NOT EXISTS idx_ai_reviews_status_tenant ON ai_reviews(status, tenant_id)",
                    "CREATE INDEX IF NOT EXISTS idx_ai_reviews_language_tenant ON ai_reviews(language, tenant_id)",
                    "CREATE INDEX IF NOT EXISTS idx_ai_diagnoses_severity_tenant ON ai_diagnoses(severity, tenant_id)",
                    "CREATE INDEX IF NOT EXISTS idx_ai_generations_tenant_created ON ai_generations(tenant_id, created_at DESC)",
                    "CREATE INDEX IF NOT EXISTS idx_ai_analyses_tenant_created ON ai_analyses(tenant_id, created_at DESC)",
                    "CREATE INDEX IF NOT EXISTS idx_ai_diagnoses_tenant_created ON ai_diagnoses(tenant_id, created_at DESC)",
                    "CREATE INDEX IF NOT EXISTS idx_ai_decisions_tenant_created ON ai_decisions(tenant_id, created_at DESC)",
                    "CREATE INDEX IF NOT EXISTS idx_ai_reviews_tenant_created ON ai_reviews(tenant_id, created_at DESC)",
                ]
                for stmt in statements:
                    cur.execute(stmt)
            conn.commit()
            logger.info("AI result repository tables initialized")
            self._tables_ensured = True
        finally:
            self._get_pool().putconn(conn)

    def _get_conn(self):
        self._ensure_tables_if_needed()
        return self._get_pool().getconn()

    def _put_conn(self, conn):
        self._get_pool().putconn(conn)

    @contextmanager
    def _connection(self):
        conn = self._get_conn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._put_conn(conn)

    def _get_tenant_id(self, explicit: Optional[str] = None) -> str:
        if explicit:
            return explicit
        return os.environ.get("ORION_AI_TENANT_ID", "default")

    # ==================== AI Generation ====================

    def save_generation(self, record: Dict[str, Any], tenant_id: Optional[str] = None) -> None:
        conn = self._get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ai_generations
                        (id, prompt, context, model, content, tokens_used, tenant_id, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        content = EXCLUDED.content,
                        tokens_used = EXCLUDED.tokens_used,
                        model = EXCLUDED.model
                    """,
                    (
                        record["id"],
                        record.get("prompt", ""),
                        json.dumps(record.get("context")) if record.get("context") else None,
                        record.get("model"),
                        record.get("content", ""),
                        record.get("tokens_used", 0),
                        self._get_tenant_id(tenant_id),
                        record["created_at"] if isinstance(record.get("created_at"), datetime) else datetime.fromisoformat(str(record.get("created_at", datetime.now(timezone.utc)))),
                    ),
                )
            conn.commit()
        finally:
            self._put_conn(conn)

    def get_generation(self, gen_id: str, tenant_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM ai_generations WHERE id = %s AND tenant_id = %s",
                    (gen_id, self._get_tenant_id(tenant_id)),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return self._row_to_generation_dict(dict(row))
        finally:
            self._put_conn(conn)

    def list_generations(self, tenant_id: Optional[str] = None, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM ai_generations WHERE tenant_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s",
                    (self._get_tenant_id(tenant_id), limit, offset),
                )
                return [self._row_to_generation_dict(dict(r)) for r in cur.fetchall()]
        finally:
            self._put_conn(conn)

    # ==================== AI Analysis ====================

    def save_analysis(self, record: Dict[str, Any], tenant_id: Optional[str] = None) -> None:
        conn = self._get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ai_analyses
                        (id, type, data, result, confidence, tenant_id, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        result = EXCLUDED.result,
                        confidence = EXCLUDED.confidence
                    """,
                    (
                        record["id"],
                        record.get("type", ""),
                        json.dumps(record.get("data")) if record.get("data") else "{}",
                        json.dumps(record.get("result")) if record.get("result") else "{}",
                        record.get("confidence", 0.0),
                        self._get_tenant_id(tenant_id),
                        record["created_at"] if isinstance(record.get("created_at"), datetime) else datetime.fromisoformat(str(record.get("created_at", datetime.now(timezone.utc)))),
                    ),
                )
            conn.commit()
        finally:
            self._put_conn(conn)

    def get_analysis(self, analysis_id: str, tenant_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM ai_analyses WHERE id = %s AND tenant_id = %s",
                    (analysis_id, self._get_tenant_id(tenant_id)),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return self._row_to_analysis_dict(dict(row))
        finally:
            self._put_conn(conn)

    def list_analyses(
        self,
        analysis_type: Optional[str] = None,
        tenant_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if analysis_type:
                    cur.execute(
                        "SELECT * FROM ai_analyses WHERE type = %s AND tenant_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s",
                        (analysis_type, self._get_tenant_id(tenant_id), limit, offset),
                    )
                else:
                    cur.execute(
                        "SELECT * FROM ai_analyses WHERE tenant_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s",
                        (self._get_tenant_id(tenant_id), limit, offset),
                    )
                return [self._row_to_analysis_dict(dict(r)) for r in cur.fetchall()]
        finally:
            self._put_conn(conn)

    # ==================== AI Diagnosis ====================

    def save_diagnosis(self, record: Dict[str, Any], tenant_id: Optional[str] = None) -> None:
        conn = self._get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ai_diagnoses
                        (id, symptoms, context, diagnosis, severity, recommendations, tenant_id, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        diagnosis = EXCLUDED.diagnosis,
                        severity = EXCLUDED.severity,
                        recommendations = EXCLUDED.recommendations
                    """,
                    (
                        record["id"],
                        json.dumps(record.get("symptoms", [])),
                        json.dumps(record.get("context")) if record.get("context") else None,
                        record.get("diagnosis", ""),
                        record.get("severity", "low"),
                        json.dumps(record.get("recommendations", [])),
                        self._get_tenant_id(tenant_id),
                        record["created_at"] if isinstance(record.get("created_at"), datetime) else datetime.fromisoformat(str(record.get("created_at", datetime.now(timezone.utc)))),
                    ),
                )
            conn.commit()
        finally:
            self._put_conn(conn)

    def get_diagnosis(self, diagnosis_id: str, tenant_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM ai_diagnoses WHERE id = %s AND tenant_id = %s",
                    (diagnosis_id, self._get_tenant_id(tenant_id)),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return self._row_to_diagnosis_dict(dict(row))
        finally:
            self._put_conn(conn)

    def list_diagnoses(
        self,
        severity: Optional[str] = None,
        tenant_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if severity:
                    cur.execute(
                        "SELECT * FROM ai_diagnoses WHERE severity = %s AND tenant_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s",
                        (severity, self._get_tenant_id(tenant_id), limit, offset),
                    )
                else:
                    cur.execute(
                        "SELECT * FROM ai_diagnoses WHERE tenant_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s",
                        (self._get_tenant_id(tenant_id), limit, offset),
                    )
                return [self._row_to_diagnosis_dict(dict(r)) for r in cur.fetchall()]
        finally:
            self._put_conn(conn)

    # ==================== AI Decisions ====================

    def save_decision(self, record: Dict[str, Any], tenant_id: Optional[str] = None) -> None:
        conn = self._get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ai_decisions
                        (id, title, description, status, recommendation, confidence,
                         context, options, tenant_id, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        status = EXCLUDED.status,
                        recommendation = EXCLUDED.recommendation,
                        confidence = EXCLUDED.confidence,
                        updated_at = NOW()
                    """,
                    (
                        record["id"],
                        record.get("title", ""),
                        record.get("description", ""),
                        record.get("status", "pending"),
                        record.get("recommendation"),
                        record.get("confidence", 0.0),
                        json.dumps(record.get("context")) if record.get("context") else None,
                        json.dumps(record.get("options")) if record.get("options") else None,
                        self._get_tenant_id(tenant_id),
                        record["created_at"] if isinstance(record.get("created_at"), datetime) else datetime.fromisoformat(str(record.get("created_at", datetime.now(timezone.utc)))),
                        record["updated_at"] if isinstance(record.get("updated_at"), datetime) else (datetime.fromisoformat(str(record["updated_at"])) if record.get("updated_at") else None),
                    ),
                )
            conn.commit()
        finally:
            self._put_conn(conn)

    def get_decision(self, decision_id: str, tenant_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM ai_decisions WHERE id = %s AND tenant_id = %s",
                    (decision_id, self._get_tenant_id(tenant_id)),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return self._row_to_decision_dict(dict(row))
        finally:
            self._put_conn(conn)

    def list_decisions(
        self,
        status: Optional[str] = None,
        tenant_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if status:
                    cur.execute(
                        "SELECT * FROM ai_decisions WHERE status = %s AND tenant_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s",
                        (status, self._get_tenant_id(tenant_id), limit, offset),
                    )
                else:
                    cur.execute(
                        "SELECT * FROM ai_decisions WHERE tenant_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s",
                        (self._get_tenant_id(tenant_id), limit, offset),
                    )
                return [self._row_to_decision_dict(dict(r)) for r in cur.fetchall()]
        finally:
            self._put_conn(conn)

    def update_decision_status(
        self,
        decision_id: str,
        status: str,
        tenant_id: Optional[str] = None,
        updated_at: Optional[datetime] = None,
    ) -> bool:
        now = updated_at or datetime.now(timezone.utc)
        conn = self._get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE ai_decisions SET status = %s, updated_at = %s WHERE id = %s AND tenant_id = %s",
                    (status, now, decision_id, self._get_tenant_id(tenant_id)),
                )
                conn.commit()
                return cur.rowcount > 0
        finally:
            self._put_conn(conn)

    # ==================== AI Reviews ====================

    def save_review(self, record: Dict[str, Any], tenant_id: Optional[str] = None) -> None:
        conn = self._get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ai_reviews
                        (id, code, language, context, reviewers, status, summary,
                         comments, score, tenant_id, created_at, completed_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        status = EXCLUDED.status,
                        summary = EXCLUDED.summary,
                        comments = EXCLUDED.comments,
                        score = EXCLUDED.score,
                        completed_at = EXCLUDED.completed_at
                    """,
                    (
                        record["id"],
                        record.get("code", ""),
                        record.get("language", ""),
                        json.dumps(record.get("context")) if record.get("context") else None,
                        json.dumps(record.get("reviewers")) if record.get("reviewers") else None,
                        record.get("status", "pending"),
                        record.get("summary"),
                        json.dumps(record.get("comments", [])),
                        record.get("score", 0.0),
                        self._get_tenant_id(tenant_id),
                        record["created_at"] if isinstance(record.get("created_at"), datetime) else datetime.fromisoformat(str(record.get("created_at", datetime.now(timezone.utc)))),
                        record["completed_at"] if isinstance(record.get("completed_at"), datetime) else (datetime.fromisoformat(str(record["completed_at"])) if record.get("completed_at") else None),
                    ),
                )
            conn.commit()
        finally:
            self._put_conn(conn)

    def get_review(self, review_id: str, tenant_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM ai_reviews WHERE id = %s AND tenant_id = %s",
                    (review_id, self._get_tenant_id(tenant_id)),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return self._row_to_review_dict(dict(row))
        finally:
            self._put_conn(conn)

    def list_reviews(
        self,
        language: Optional[str] = None,
        status: Optional[str] = None,
        tenant_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                conditions = ["tenant_id = %s"]
                params: list = [self._get_tenant_id(tenant_id)]
                if language:
                    conditions.append("language = %s")
                    params.append(language)
                if status:
                    conditions.append("status = %s")
                    params.append(status)
                where = " AND ".join(conditions)
                params.extend([limit, offset])
                cur.execute(
                    f"SELECT * FROM ai_reviews WHERE {where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
                    tuple(params),
                )
                return [self._row_to_review_dict(dict(r)) for r in cur.fetchall()]
        finally:
            self._put_conn(conn)

    # ==================== Row -> Dict 转换 ====================

    @staticmethod
    def _row_to_generation_dict(row: Dict[str, Any]) -> Dict[str, Any]:
        row["context"] = json.loads(row["context"]) if row.get("context") else None
        return row

    @staticmethod
    def _row_to_analysis_dict(row: Dict[str, Any]) -> Dict[str, Any]:
        row["data"] = json.loads(row["data"]) if row.get("data") else {}
        row["result"] = json.loads(row["result"]) if row.get("result") else {}
        return row

    @staticmethod
    def _row_to_diagnosis_dict(row: Dict[str, Any]) -> Dict[str, Any]:
        row["symptoms"] = json.loads(row["symptoms"]) if row.get("symptoms") else []
        row["context"] = json.loads(row["context"]) if row.get("context") else None
        row["recommendations"] = json.loads(row["recommendations"]) if row.get("recommendations") else []
        return row

    @staticmethod
    def _row_to_decision_dict(row: Dict[str, Any]) -> Dict[str, Any]:
        row["context"] = json.loads(row["context"]) if row.get("context") else None
        row["options"] = json.loads(row["options"]) if row.get("options") else None
        return row

    @staticmethod
    def _row_to_review_dict(row: Dict[str, Any]) -> Dict[str, Any]:
        row["context"] = json.loads(row["context"]) if row.get("context") else None
        row["reviewers"] = json.loads(row["reviewers"]) if row.get("reviewers") else None
        row["comments"] = json.loads(row["comments"]) if row.get("comments") else []
        return row


# 全局仓储实例
ai_result_repository = AIResultRepository()
