-- Migration #053: Create ai_embeddings table
-- AI Python Phase 1.3: Cache vector embeddings for text chunks

CREATE TABLE IF NOT EXISTS ai_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    source_type VARCHAR(64) NOT NULL,     -- document, code, knowledge, query
    source_id VARCHAR(255) NOT NULL,
    chunk_index INTEGER DEFAULT 0,
    model VARCHAR(255) NOT NULL,
    dimensions INTEGER DEFAULT 0,
    embedding_vector DOUBLE PRECISION[] DEFAULT '{}',
    text_content TEXT DEFAULT '',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_tenant ON ai_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_source ON ai_embeddings(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_model ON ai_embeddings(model);
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_tenant_source ON ai_embeddings(tenant_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_created ON ai_embeddings(created_at DESC);