-- 001: Core knowledge tables for pandawiki-svc
-- Space (knowledge space: logical grouping)
CREATE TABLE IF NOT EXISTS kb_spaces (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    type VARCHAR(16) NOT NULL DEFAULT 'public',
    source VARCHAR(16) NOT NULL DEFAULT 'manual',
    owner_id VARCHAR(64) NOT NULL DEFAULT 'system',
    team_id VARCHAR(64),
    description TEXT,
    doc_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_spaces_tenant ON kb_spaces(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_kb_spaces_type ON kb_spaces(tenant_id, type);

-- Documents
CREATE TABLE IF NOT EXISTS kb_docs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    space_id UUID NOT NULL REFERENCES kb_spaces(id),
    title VARCHAR(512) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(16) NOT NULL DEFAULT 'knowledge',
    source VARCHAR(16) NOT NULL DEFAULT 'manual',
    tags TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(16) NOT NULL DEFAULT 'draft',
    version INT NOT NULL DEFAULT 1,
    author_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_docs_tenant ON kb_docs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_kb_docs_space ON kb_docs(space_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_type ON kb_docs(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_kb_docs_status ON kb_docs(tenant_id, status);

-- Document versions
CREATE TABLE IF NOT EXISTS kb_doc_versions (
    id UUID PRIMARY KEY,
    doc_id UUID NOT NULL REFERENCES kb_docs(id),
    version INT NOT NULL,
    title VARCHAR(512) NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_doc_versions_doc ON kb_doc_versions(doc_id, version);

-- Sync logs
CREATE TABLE IF NOT EXISTS kb_sync_logs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    source VARCHAR(128),
    total_docs INT NOT NULL DEFAULT 0,
    success_docs INT NOT NULL DEFAULT 0,
    failed_docs INT NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_sync_logs_tenant ON kb_sync_logs(tenant_id, started_at);
