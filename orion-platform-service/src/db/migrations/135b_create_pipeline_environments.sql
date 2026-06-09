-- Migration 135: Pipeline Environments Table
-- GAP-CN-02: Multi-environment management (dev/staging/production)
-- Previously: No environment concept, each run was independent with no environment-level config management

CREATE TABLE IF NOT EXISTS pipeline_environments (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(64) NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    variables JSONB NOT NULL DEFAULT '{}',
    approval_required BOOLEAN NOT NULL DEFAULT false,
    approval_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_env_name UNIQUE (tenant_id, name),
    CONSTRAINT chk_env_name CHECK (name ~ '^[a-z][a-z0-9_]*$'),
    CONSTRAINT chk_approval_count CHECK (approval_count >= 1)
);

CREATE INDEX idx_pipeline_envs_tenant ON pipeline_environments(tenant_id);
CREATE INDEX idx_pipeline_envs_name ON pipeline_environments(name);
CREATE INDEX idx_pipeline_envs_order ON pipeline_environments(display_order);

COMMENT ON TABLE pipeline_environments IS 'Pipeline deployment environments (development, staging, production, etc.)';
COMMENT ON COLUMN pipeline_environments.name IS 'Environment name: development, staging, production, etc.';
COMMENT ON COLUMN pipeline_environments.display_order IS 'Display ordering in UI (lower = first)';
COMMENT ON COLUMN pipeline_environments.variables IS 'Environment-specific variables merged into pipeline runs';
COMMENT ON COLUMN pipeline_environments.approval_required IS 'Whether approval is required before deploying to this environment';
COMMENT ON COLUMN pipeline_environments.approval_count IS 'Number of approvals required when approval_required is true';

-- Seed default environments for all tenants (these can be customized per tenant)
-- Note: In a multi-tenant system, defaults are created per-tenant on tenant creation.
-- These seeds are for reference and manual setup only.

INSERT INTO pipeline_environments (id, tenant_id, name, description, display_order, variables, approval_required, approval_count)
VALUES
    ('env-seed-dev', 'default-tenant', 'development', 'Development environment for active development and testing', 0, '{"NODE_ENV": "development", "LOG_LEVEL": "debug"}', false, 1),
    ('env-seed-staging', 'default-tenant', 'staging', 'Staging environment for pre-production validation', 1, '{"NODE_ENV": "staging", "LOG_LEVEL": "info"}', true, 1),
    ('env-seed-prod', 'default-tenant', 'production', 'Production environment for live traffic', 2, '{"NODE_ENV": "production", "LOG_LEVEL": "warn"}', true, 2)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Rollback:
-- DROP TABLE IF EXISTS pipeline_environments;
