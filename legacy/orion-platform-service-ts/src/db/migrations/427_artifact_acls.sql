-- Migration 427: Create artifact ACL tables
-- Tables: artifact_acls
-- Date: 2026-07-03

-- Artifact ACLs Table
CREATE TABLE IF NOT EXISTS artifact_acls (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    artifact_id VARCHAR(128) NOT NULL,
    subject_type VARCHAR(16) NOT NULL,           -- user, group, service
    subject_id VARCHAR(128) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',     -- ["read", "write", "admin", "delete"]
    effect VARCHAR(16) NOT NULL DEFAULT 'allow', -- allow, deny
    created_by VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (tenant_id, artifact_id, subject_type, subject_id)
);

CREATE INDEX idx_artifact_acls_tenant ON artifact_acls (tenant_id);
CREATE INDEX idx_artifact_acls_artifact ON artifact_acls (artifact_id);
CREATE INDEX idx_artifact_acls_subject ON artifact_acls (subject_type, subject_id);
CREATE INDEX idx_artifact_acls_tenant_artifact ON artifact_acls (tenant_id, artifact_id);

COMMENT ON TABLE artifact_acls IS 'Access Control Lists for artifacts';
