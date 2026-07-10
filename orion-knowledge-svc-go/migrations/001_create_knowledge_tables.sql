-- Knowledge service migrations
-- 001: Create knowledge space, document, and version tables

-- Knowledge spaces
CREATE TABLE IF NOT EXISTS kb_spaces (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'public',
    source VARCHAR(256),
    owner_id VARCHAR(64) NOT NULL,
    team_id VARCHAR(64),
    description TEXT,
    doc_count INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_spaces_tenant ON kb_spaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_spaces_owner ON kb_spaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_kb_spaces_type ON kb_spaces(type);

-- Knowledge documents
CREATE TABLE IF NOT EXISTS kb_docs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    space_id VARCHAR(64) NOT NULL REFERENCES kb_spaces(id) ON DELETE CASCADE,
    title VARCHAR(512) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'docs',
    source VARCHAR(256),
    tags JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    version INT DEFAULT 1,
    author_id VARCHAR(64),
    embedding BYTEA,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_docs_tenant ON kb_docs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_space ON kb_docs(space_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_status ON kb_docs(status);
CREATE INDEX IF NOT EXISTS idx_kb_docs_type ON kb_docs(type);

-- Document versions
CREATE TABLE IF NOT EXISTS kb_doc_versions (
    id VARCHAR(64) PRIMARY KEY,
    doc_id VARCHAR(64) NOT NULL REFERENCES kb_docs(id) ON DELETE CASCADE,
    version INT NOT NULL,
    title VARCHAR(512) NOT NULL,
    content TEXT NOT NULL,
    tags JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_doc_versions_doc ON kb_doc_versions(doc_id);
