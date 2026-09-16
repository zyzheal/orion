-- 656_create_vector_missing_tables.sql
-- vector 模块: vector_index / vector_record 2 张表无 CREATE TABLE。
-- 回滚见 656_create_vector_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS vector_index (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    dimensions INTEGER NOT NULL DEFAULT 1536,
    metric     TEXT NOT NULL DEFAULT 'cosine',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vector_index_tenant ON vector_index(tenant_id);

CREATE TABLE IF NOT EXISTS vector_record (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id   UUID NOT NULL,
    vector     TEXT NOT NULL,
    metadata   JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vector_record_store ON vector_record(store_id);
