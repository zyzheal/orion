-- Build module tables (auto-generated)

CREATE TABLE IF NOT EXISTS builds (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    pipeline_run_id VARCHAR(255) NOT NULL,
    source_ref VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    image VARCHAR(255) NOT NULL,
    tag VARCHAR(255) NOT NULL,
    build_args VARCHAR(255) NOT NULL,
    logs VARCHAR(255) NOT NULL,
    duration BIGINT NOT NULL,
    error VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_builds_tenant ON builds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_builds_created ON builds(created_at DESC);

CREATE TABLE IF NOT EXISTS build_environments (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    image VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    config VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_build_environments_tenant ON build_environments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_build_environments_created ON build_environments(created_at DESC);

