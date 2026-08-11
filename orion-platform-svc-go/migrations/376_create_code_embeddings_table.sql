-- Code embedding module tables — semantic code search infrastructure
-- Migration 376

CREATE TABLE IF NOT EXISTS code_embeddings (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    repo_id VARCHAR(128) NOT NULL,
    file_path TEXT NOT NULL,
    language VARCHAR(32) DEFAULT 'unknown',
    content TEXT NOT NULL,
    vector JSONB NOT NULL,
    model VARCHAR(64) DEFAULT 'code-embedding-3-small',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_embeddings_tenant ON code_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_repo ON code_embeddings(tenant_id, repo_id);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_language ON code_embeddings(language);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_created ON code_embeddings(created_at DESC);

CREATE TABLE IF NOT EXISTS code_embedding_stats (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    repo_id VARCHAR(128) NOT NULL,
    total_embeddings BIGINT DEFAULT 0,
    languages JSONB DEFAULT '{}'::JSONB,
    last_embedded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_embed_stats_repo UNIQUE (tenant_id, repo_id)
);

CREATE INDEX IF NOT EXISTS idx_code_embed_stats_tenant ON code_embedding_stats(tenant_id);