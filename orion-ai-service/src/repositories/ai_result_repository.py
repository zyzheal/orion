"""
AI 结果仓储层

使用 SQLite 持久化 AI 分析、审查、决策等结果。
"""

import json
import logging
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# 默认数据库路径（服务本地存储）
_DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "ai_results.db"


class AIResultRepository:
    """AI 分析/审查/决策结果仓储"""

    def __init__(self, db_path: Optional[str] = None):
        self._db_path = db_path or str(_DEFAULT_DB_PATH)
        self._local = threading.local()
        self._ensure_tables()

    def _get_conn(self) -> sqlite3.Connection:
        """获取线程本地连接"""
        if not hasattr(self._local, "conn"):
            Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
            self._local.conn = sqlite3.connect(
                self._db_path, check_same_thread=False
            )
            self._local.conn.row_factory = sqlite3.Row
        return self._local.conn

    def _ensure_tables(self) -> None:
        """初始化数据库表"""
        conn = self._get_conn()
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS ai_generations (
                id TEXT PRIMARY KEY,
                prompt TEXT NOT NULL,
                context TEXT,
                model TEXT,
                content TEXT NOT NULL,
                tokens_used INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ai_analyses (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                data TEXT NOT NULL,
                result TEXT NOT NULL,
                confidence REAL NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ai_diagnoses (
                id TEXT PRIMARY KEY,
                symptoms TEXT NOT NULL,
                context TEXT,
                diagnosis TEXT NOT NULL,
                severity TEXT NOT NULL,
                recommendations TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ai_decisions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT NOT NULL,
                recommendation TEXT,
                confidence REAL DEFAULT 0.0,
                context TEXT,
                options TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS ai_reviews (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL,
                language TEXT NOT NULL,
                context TEXT,
                reviewers TEXT,
                status TEXT NOT NULL,
                summary TEXT,
                comments TEXT NOT NULL,
                score REAL DEFAULT 0.0,
                created_at TEXT NOT NULL,
                completed_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_ai_analyses_type
                ON ai_analyses(type);
            CREATE INDEX IF NOT EXISTS idx_ai_decisions_status
                ON ai_decisions(status);
            CREATE INDEX IF NOT EXISTS idx_ai_reviews_status
                ON ai_reviews(status);
            CREATE INDEX IF NOT EXISTS idx_ai_reviews_language
                ON ai_reviews(language);
            CREATE INDEX IF NOT EXISTS idx_ai_diagnoses_severity
                ON ai_diagnoses(severity);
            """
        )
        conn.commit()
        logger.info("AI result repository tables initialized at %s", self._db_path)

    # ==================== AI Generation ====================

    def save_generation(self, record: Dict[str, Any]) -> None:
        """保存 AI 生成结果"""
        conn = self._get_conn()
        conn.execute(
            """
            INSERT OR REPLACE INTO ai_generations
                (id, prompt, context, model, content, tokens_used, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record["id"],
                record.get("prompt", ""),
                json.dumps(record.get("context")) if record.get("context") else None,
                record.get("model"),
                record.get("content", ""),
                record.get("tokens_used", 0),
                record["created_at"].isoformat()
                if isinstance(record["created_at"], datetime)
                else record["created_at"],
            ),
        )
        conn.commit()

    def get_generation(self, gen_id: str) -> Optional[Dict[str, Any]]:
        """根据 ID 获取生成结果"""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM ai_generations WHERE id = ?", (gen_id,)
        ).fetchone()
        if not row:
            return None
        return self._row_to_generation_dict(row)

    def list_generations(
        self, limit: int = 100, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """列出生成结果"""
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM ai_generations ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        return [self._row_to_generation_dict(r) for r in rows]

    # ==================== AI Analysis ====================

    def save_analysis(self, record: Dict[str, Any]) -> None:
        """保存 AI 分析结果"""
        conn = self._get_conn()
        conn.execute(
            """
            INSERT OR REPLACE INTO ai_analyses
                (id, type, data, result, confidence, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                record["id"],
                record.get("type", ""),
                json.dumps(record.get("data")) if record.get("data") else "{}",
                json.dumps(record.get("result")) if record.get("result") else "{}",
                record.get("confidence", 0.0),
                record["created_at"].isoformat()
                if isinstance(record["created_at"], datetime)
                else record["created_at"],
            ),
        )
        conn.commit()

    def get_analysis(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """根据 ID 获取分析结果"""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM ai_analyses WHERE id = ?", (analysis_id,)
        ).fetchone()
        if not row:
            return None
        return self._row_to_analysis_dict(row)

    def list_analyses(
        self, analysis_type: Optional[str] = None, limit: int = 100, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """列出分析结果"""
        conn = self._get_conn()
        if analysis_type:
            rows = conn.execute(
                "SELECT * FROM ai_analyses WHERE type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (analysis_type, limit, offset),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM ai_analyses ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
        return [self._row_to_analysis_dict(r) for r in rows]

    # ==================== AI Diagnosis ====================

    def save_diagnosis(self, record: Dict[str, Any]) -> None:
        """保存 AI 诊断结果"""
        conn = self._get_conn()
        conn.execute(
            """
            INSERT OR REPLACE INTO ai_diagnoses
                (id, symptoms, context, diagnosis, severity, recommendations, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record["id"],
                json.dumps(record.get("symptoms", [])),
                json.dumps(record.get("context")) if record.get("context") else None,
                record.get("diagnosis", ""),
                record.get("severity", "low"),
                json.dumps(record.get("recommendations", [])),
                record["created_at"].isoformat()
                if isinstance(record["created_at"], datetime)
                else record["created_at"],
            ),
        )
        conn.commit()

    def get_diagnosis(self, diagnosis_id: str) -> Optional[Dict[str, Any]]:
        """根据 ID 获取诊断结果"""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM ai_diagnoses WHERE id = ?", (diagnosis_id,)
        ).fetchone()
        if not row:
            return None
        return self._row_to_diagnosis_dict(row)

    def list_diagnoses(
        self, severity: Optional[str] = None, limit: int = 100, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """列出诊断结果"""
        conn = self._get_conn()
        if severity:
            rows = conn.execute(
                "SELECT * FROM ai_diagnoses WHERE severity = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (severity, limit, offset),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM ai_diagnoses ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
        return [self._row_to_diagnosis_dict(r) for r in rows]

    # ==================== AI Decisions ====================

    def save_decision(self, record: Dict[str, Any]) -> None:
        """保存 AI 决策"""
        conn = self._get_conn()
        conn.execute(
            """
            INSERT OR REPLACE INTO ai_decisions
                (id, title, description, status, recommendation, confidence,
                 context, options, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                record["created_at"].isoformat()
                if isinstance(record["created_at"], datetime)
                else record["created_at"],
                record["updated_at"].isoformat()
                if record.get("updated_at") and isinstance(record["updated_at"], datetime)
                else record.get("updated_at"),
            ),
        )
        conn.commit()

    def get_decision(self, decision_id: str) -> Optional[Dict[str, Any]]:
        """根据 ID 获取决策"""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM ai_decisions WHERE id = ?", (decision_id,)
        ).fetchone()
        if not row:
            return None
        return self._row_to_decision_dict(row)

    def list_decisions(
        self, status: Optional[str] = None, limit: int = 100, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """列出决策"""
        conn = self._get_conn()
        if status:
            rows = conn.execute(
                "SELECT * FROM ai_decisions WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (status, limit, offset),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM ai_decisions ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
        return [self._row_to_decision_dict(r) for r in rows]

    def update_decision_status(
        self, decision_id: str, status: str, updated_at: Optional[datetime] = None
    ) -> bool:
        """更新决策状态"""
        conn = self._get_conn()
        now = updated_at or datetime.now(timezone.utc)
        cursor = conn.execute(
            "UPDATE ai_decisions SET status = ?, updated_at = ? WHERE id = ?",
            (status, now.isoformat(), decision_id),
        )
        conn.commit()
        return cursor.rowcount > 0

    # ==================== AI Reviews ====================

    def save_review(self, record: Dict[str, Any]) -> None:
        """保存 AI 审查结果"""
        conn = self._get_conn()
        conn.execute(
            """
            INSERT OR REPLACE INTO ai_reviews
                (id, code, language, context, reviewers, status, summary,
                 comments, score, created_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                record["created_at"].isoformat()
                if isinstance(record["created_at"], datetime)
                else record["created_at"],
                record["completed_at"].isoformat()
                if record.get("completed_at") and isinstance(record["completed_at"], datetime)
                else record.get("completed_at"),
            ),
        )
        conn.commit()

    def get_review(self, review_id: str) -> Optional[Dict[str, Any]]:
        """根据 ID 获取审查结果"""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM ai_reviews WHERE id = ?", (review_id,)
        ).fetchone()
        if not row:
            return None
        return self._row_to_review_dict(row)

    def list_reviews(
        self,
        language: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """列出审查结果"""
        conn = self._get_conn()
        query = "SELECT * FROM ai_reviews"
        params: list = []
        conditions = []
        if language:
            conditions.append("language = ?")
            params.append(language)
        if status:
            conditions.append("status = ?")
            params.append(status)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        rows = conn.execute(query, tuple(params)).fetchall()
        return [self._row_to_review_dict(r) for r in rows]

    # ==================== Row -> Dict 转换 ====================

    def _row_to_generation_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        d["context"] = json.loads(d["context"]) if d.get("context") else None
        return d

    def _row_to_analysis_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        d["data"] = json.loads(d["data"]) if d.get("data") else {}
        d["result"] = json.loads(d["result"]) if d.get("result") else {}
        return d

    def _row_to_diagnosis_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        d["symptoms"] = json.loads(d["symptoms"]) if d.get("symptoms") else []
        d["context"] = json.loads(d["context"]) if d.get("context") else None
        d["recommendations"] = json.loads(d["recommendations"]) if d.get("recommendations") else []
        return d

    def _row_to_decision_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        d["context"] = json.loads(d["context"]) if d.get("context") else None
        d["options"] = json.loads(d["options"]) if d.get("options") else None
        return d

    def _row_to_review_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        d["context"] = json.loads(d["context"]) if d.get("context") else None
        d["reviewers"] = json.loads(d["reviewers"]) if d.get("reviewers") else None
        d["comments"] = json.loads(d["comments"]) if d.get("comments") else []
        return d


# 全局仓储实例
ai_result_repository = AIResultRepository()
