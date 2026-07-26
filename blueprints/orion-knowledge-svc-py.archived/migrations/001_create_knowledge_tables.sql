CREATE TABLE IF NOT EXISTS knowledge_spaces (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    type VARCHAR(32) NOT NULL DEFAULT 'general',
    doc_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_spaces_tenant ON knowledge_spaces(tenant_id, type);

CREATE TABLE IF NOT EXISTS knowledge_docs (
    id UUID PRIMARY KEY,
    space_id UUID NOT NULL REFERENCES knowledge_spaces(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    title VARCHAR(512) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    tags JSONB NOT NULL DEFAULT '[]',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_docs_space ON knowledge_docs(space_id, updated_at);
CREATE INDEX idx_knowledge_docs_tenant ON knowledge_docs(tenant_id);

CREATE TABLE IF NOT EXISTS knowledge_doc_versions (
    id UUID PRIMARY KEY,
    doc_id UUID NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
    version INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doc_versions_doc ON knowledge_doc_versions(doc_id, version);
