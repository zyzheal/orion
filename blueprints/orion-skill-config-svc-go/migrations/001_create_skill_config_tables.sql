-- Skill packages: core skill definitions
CREATE TABLE IF NOT EXISTS skill_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(256) NOT NULL UNIQUE,
    version VARCHAR(64) NOT NULL DEFAULT '1.0.0',
    description TEXT NOT NULL DEFAULT '',
    category VARCHAR(128) NOT NULL DEFAULT 'general',
    tags TEXT[] NOT NULL DEFAULT '{}',
    author VARCHAR(256) NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    schema JSONB NOT NULL DEFAULT '{}',
    capabilities JSONB,
    schemas JSONB,
    is_version_locked BOOLEAN NOT NULL DEFAULT false,
    install_count INT NOT NULL DEFAULT 0,
    rating NUMERIC(3,2) NOT NULL DEFAULT 0.0,
    rating_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skill_packages_status ON skill_packages(status);
CREATE INDEX idx_skill_packages_category ON skill_packages(category);
CREATE INDEX idx_skill_packages_name ON skill_packages(name);

-- Skill versions: version history
CREATE TABLE IF NOT EXISTS skill_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    version VARCHAR(64) NOT NULL,
    changelog TEXT,
    schema JSONB NOT NULL DEFAULT '{}',
    schema_snapshot JSONB,
    is_latest BOOLEAN NOT NULL DEFAULT false,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skill_versions_skill_id ON skill_versions(skill_id);

-- Skill instances: tenant-specific instances
CREATE TABLE IF NOT EXISTS skill_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    project_id VARCHAR(64),
    name VARCHAR(256) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'inactive',
    config JSONB NOT NULL DEFAULT '{}',
    bindings JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN NOT NULL DEFAULT false,
    version VARCHAR(64) NOT NULL DEFAULT '1.0.0',
    created_by VARCHAR(256),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skill_instances_tenant ON skill_instances(tenant_id);
CREATE INDEX idx_skill_instances_skill ON skill_instances(skill_id, tenant_id);

-- Skill reviews: user ratings
CREATE TABLE IF NOT EXISTS skill_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    user_id VARCHAR(256) NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (skill_id, user_id)
);

CREATE INDEX idx_skill_reviews_skill_id ON skill_reviews(skill_id);

-- Skill executions: execution records
CREATE TABLE IF NOT EXISTS skill_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    skill_id UUID NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    instance_id UUID,
    capability VARCHAR(256),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB,
    error_message TEXT,
    duration_ms INT,
    triggered_by VARCHAR(256),
    trigger_mode VARCHAR(32) NOT NULL DEFAULT 'manual',
    metadata JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skill_executions_tenant ON skill_executions(tenant_id);
CREATE INDEX idx_skill_executions_skill ON skill_executions(skill_id, tenant_id);

-- Skill audit logs: lifecycle audit trail
CREATE TABLE IF NOT EXISTS skill_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    action VARCHAR(64) NOT NULL,
    actor_id VARCHAR(256),
    actor_name VARCHAR(256),
    old_status VARCHAR(32),
    new_status VARCHAR(32),
    reason TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skill_audit_logs_skill_id ON skill_audit_logs(skill_id);
