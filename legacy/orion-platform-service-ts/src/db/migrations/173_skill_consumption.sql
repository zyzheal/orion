-- Migration 173: Skill Consumption Scenarios
-- Extends skill_packages with capability metadata, adds skill_instances for tenant/project-scoped skill configurations

-- ==========================================
-- 1. Extend skill_packages table
-- ==========================================

ALTER TABLE skill_packages ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '[]';
COMMENT ON COLUMN skill_packages.capabilities IS 'List of capability metadata for skill discovery and routing';

ALTER TABLE skill_packages ADD COLUMN IF NOT EXISTS schemas JSONB NOT NULL DEFAULT '{}';
COMMENT ON COLUMN skill_packages.schemas IS 'Extended schema definitions (complements the existing schema column for complex validation)';

ALTER TABLE skill_packages ADD COLUMN IF NOT EXISTS is_version_locked BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN skill_packages.is_version_locked IS 'Whether the package is locked to a specific version to prevent breaking changes';

ALTER TABLE skill_packages ADD COLUMN IF NOT EXISTS version_locked_at TIMESTAMPTZ;
COMMENT ON COLUMN skill_packages.version_locked_at IS 'Timestamp when version locking was applied';

-- ==========================================
-- 2. skill_instances table
-- Stores skill instance configurations scoped to tenant/project, enabling isolated skill deployments
-- ==========================================

CREATE TABLE IF NOT EXISTS skill_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL,  -- optional project scope; use a sentinel UUID for tenant-wide instances
    skill_id UUID NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    instance_name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'inactive',  -- inactive | active | paused | error
    config JSONB NOT NULL DEFAULT '{}',  -- runtime configuration overrides
    bindings JSONB NOT NULL DEFAULT '{}',  -- external service bindings (API keys, endpoints, etc.)
    metadata JSONB NOT NULL DEFAULT '{}',  -- extra metadata: tags, owner, usage_stats, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users(id),
    UNIQUE(tenant_id, project_id, instance_name)
);

CREATE INDEX idx_skill_instances_tenant_id ON skill_instances(tenant_id);
CREATE INDEX idx_skill_instances_project_id ON skill_instances(project_id);
CREATE INDEX idx_skill_instances_skill_id ON skill_instances(skill_id);
CREATE INDEX idx_skill_instances_status ON skill_instances(status);
CREATE INDEX idx_skill_instances_tenant_project ON skill_instances(tenant_id, project_id);

COMMENT ON TABLE skill_instances IS 'Skill instance configurations scoped to tenant/project for isolated skill deployments';
COMMENT ON COLUMN skill_instances.project_id IS 'Optional project scope; use a sentinel UUID for tenant-wide instances';
COMMENT ON COLUMN skill_instances.config IS 'Runtime configuration overrides for this instance';
COMMENT ON COLUMN skill_instances.bindings IS 'External service bindings (API keys, endpoints, etc.)';
