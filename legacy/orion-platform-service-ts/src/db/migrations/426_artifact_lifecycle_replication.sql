-- Migration 426: Create artifact lifecycle and replication tables
-- Tables: artifact_lifecycle_policies, artifact_replications
-- Date: 2026-07-03

-- Artifact Lifecycle Policies Table
CREATE TABLE IF NOT EXISTS artifact_lifecycle_policies (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    artifact_id VARCHAR(128) NOT NULL,
    policy_type VARCHAR(32) NOT NULL,          -- expire, retention, promotion
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_artifact_lifecycle_tenant ON artifact_lifecycle_policies (tenant_id);
CREATE INDEX idx_artifact_lifecycle_artifact ON artifact_lifecycle_policies (artifact_id);
CREATE INDEX idx_artifact_lifecycle_type ON artifact_lifecycle_policies (policy_type);
CREATE INDEX idx_artifact_lifecycle_enabled ON artifact_lifecycle_policies (tenant_id, enabled);

COMMENT ON TABLE artifact_lifecycle_policies IS 'Lifecycle policies for artifacts (expire, retention, promotion rules)';

-- Artifact Replications Table
CREATE TABLE IF NOT EXISTS artifact_replications (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    artifact_id VARCHAR(128) NOT NULL,
    source_registry VARCHAR(256) NOT NULL,
    target_registry VARCHAR(256) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, cancelled
    progress INTEGER NOT NULL DEFAULT 0,            -- 0-100
    error_message TEXT,
    initiated_by VARCHAR(128),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_artifact_replications_tenant ON artifact_replications (tenant_id);
CREATE INDEX idx_artifact_replications_artifact ON artifact_replications (artifact_id);
CREATE INDEX idx_artifact_replications_status ON artifact_replications (status);
CREATE INDEX idx_artifact_replications_created ON artifact_replications (created_at DESC);

COMMENT ON TABLE artifact_replications IS 'Cross-registry artifact replication tasks';
