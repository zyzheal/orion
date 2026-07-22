-- 056: AI 向量嵌入表 (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ai_vectors (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB,
    model TEXT,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_vectors_tenant_created
    ON ai_vectors(tenant_id, created_at DESC);

-- pgvector HNSW 索引（需 pgvector >= 0.5.0）
CREATE INDEX IF NOT EXISTS idx_ai_vectors_embedding
    ON ai_vectors USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
