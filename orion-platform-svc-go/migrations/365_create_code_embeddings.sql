-- Create code_embeddings table for code-embedding module
CREATE TABLE IF NOT EXISTS code_embeddings (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    repo_id VARCHAR(256),
    file_path TEXT,
    language VARCHAR(32),
    content TEXT,
    vector TEXT,
    model VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 补齐 code_embeddings：376_create_code_embeddings_table.sql 的定义晚于 365_create_code_embeddings.sql，按序执行时表已存在
ALTER TABLE code_embeddings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 补齐 code_embeddings：376_create_code_embeddings_table.sql 的定义晚于 365_create_code_embeddings.sql，按序执行时表已存在
ALTER TABLE code_embeddings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_code_embeddings_tenant ON code_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_repo ON code_embeddings(tenant_id, repo_id);
