-- =====================================================
-- PandaWiki Service Database Schema
--
-- This service acts as a proxy to PandaWiki backend.
-- Local DB is used for caching and audit logging only.
-- =====================================================

-- Cache table for wiki spaces (optional local cache)
CREATE TABLE IF NOT EXISTS wiki_spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pandawiki_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tenant_id VARCHAR(255) NOT NULL,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX idx_wiki_spaces_tenant ON wiki_spaces(tenant_id);
CREATE INDEX idx_wiki_spaces_expires ON wiki_spaces(expires_at);

-- Cache table for wiki documents (optional local cache)
CREATE TABLE IF NOT EXISTS wiki_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pandawiki_id VARCHAR(255) UNIQUE NOT NULL,
    space_id VARCHAR(255) NOT NULL,
    title VARCHAR(512) NOT NULL,
    content TEXT,
    parent_id VARCHAR(255),
    tags TEXT[],
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX idx_wiki_documents_space ON wiki_documents(space_id);
CREATE INDEX idx_wiki_documents_cached ON wiki_documents(cached_at);

-- Audit log for proxy requests
CREATE TABLE IF NOT EXISTS pandawiki_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    request_method VARCHAR(10) NOT NULL,
    request_path VARCHAR(512) NOT NULL,
    response_status INTEGER,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pandawiki_audit_tenant ON pandawiki_audit_logs(tenant_id);
CREATE INDEX idx_pandawiki_audit_created ON pandawiki_audit_logs(created_at DESC);