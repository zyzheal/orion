-- Knowledge module tables

CREATE TABLE IF NOT EXISTS knowledge_spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'public',
    description VARCHAR(255),
    team_id VARCHAR(255),
    owner_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_spaces_tenant_id ON knowledge_spaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_spaces_type ON knowledge_spaces(type);

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    space_id VARCHAR(255) NOT NULL,
    tags JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    author_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_tenant_id ON knowledge_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_space_id ON knowledge_documents(space_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_status ON knowledge_documents(status);

CREATE TABLE IF NOT EXISTS knowledge_doc_versions (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_doc_versions_document_id ON knowledge_doc_versions(document_id);

CREATE TABLE IF NOT EXISTS knowledge_sync_logs (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    source VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    error_msg TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sync_logs_tenant_id ON knowledge_sync_logs(tenant_id);
