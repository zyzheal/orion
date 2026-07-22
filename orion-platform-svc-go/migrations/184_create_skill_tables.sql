-- Skill module tables (auto-generated)

CREATE TABLE IF NOT EXISTS skills (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    install_count BIGINT NOT NULL,
    avg_rating DOUBLE PRECISION NOT NULL,
    rating_count BIGINT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_skills_tenant ON skills(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skills_created ON skills(created_at DESC);

CREATE TABLE IF NOT EXISTS skill_instances (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    skill_id VARCHAR(255) NOT NULL,
    instance_name VARCHAR(255) NOT NULL,
    config VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_skill_instances_tenant ON skill_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skill_instances_created ON skill_instances(created_at DESC);

CREATE TABLE IF NOT EXISTS skill_executions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    skill_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    input VARCHAR(255) NOT NULL,
    output VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    duration_ms BIGINT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_skill_executions_tenant ON skill_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skill_executions_created ON skill_executions(created_at DESC);

CREATE TABLE IF NOT EXISTS skill_reviews (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    skill_id VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    submitted_by VARCHAR(255) NOT NULL,
    reviewed_by VARCHAR(255) NOT NULL,
    review_note VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_skill_reviews_tenant ON skill_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skill_reviews_created ON skill_reviews(created_at DESC);

CREATE TABLE IF NOT EXISTS skill_audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    skill_id VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    details VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_skill_audit_logs_tenant ON skill_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skill_audit_logs_created ON skill_audit_logs(created_at DESC);

