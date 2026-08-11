-- Migration 391: rca_fix_suggestions table (support RCA fix suggestion retrieval)
-- Stores domain-expert-defined fix suggestions keyed by root cause category.

CREATE TABLE IF NOT EXISTS rca_fix_suggestions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    root_cause_id VARCHAR(64) NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT '',
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    priority INT NOT NULL DEFAULT 1,
    status VARCHAR(16) NOT NULL DEFAULT 'suggested',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rca_fix_suggestions_root_cause ON rca_fix_suggestions(root_cause_id);
CREATE INDEX IF NOT EXISTS idx_rca_fix_suggestions_category ON rca_fix_suggestions(category);
CREATE INDEX IF NOT EXISTS idx_rca_fix_suggestions_tenant ON rca_fix_suggestions(tenant_id);