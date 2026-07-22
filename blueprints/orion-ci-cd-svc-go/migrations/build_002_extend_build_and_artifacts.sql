-- Extend builds table with fields from Node.js BuildRepository
ALTER TABLE builds ADD COLUMN IF NOT EXISTS project_id UUID;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS pipeline_run_id UUID;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS image VARCHAR(500);
ALTER TABLE builds ADD COLUMN IF NOT EXISTS tag VARCHAR(255);
ALTER TABLE builds ADD COLUMN IF NOT EXISTS source_ref VARCHAR(500);
ALTER TABLE builds ADD COLUMN IF NOT EXISTS build_args JSONB DEFAULT '{}';
ALTER TABLE builds ADD COLUMN IF NOT EXISTS duration_ms BIGINT;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Build environments table
CREATE TABLE IF NOT EXISTS build_environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    image VARCHAR(500) NOT NULL,
    description TEXT,
    config JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_build_environments_tenant_id ON build_environments (tenant_id);

-- Artifacts table (mirrors the Node.js ArtifactRepository schema)
CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(500) NOT NULL,
    type VARCHAR(100) NOT NULL,
    storage_type VARCHAR(50) DEFAULT 'local',
    storage_path VARCHAR(1000) NOT NULL,
    size_bytes BIGINT DEFAULT 0,
    checksum_sha256 VARCHAR(64),
    run_id UUID NOT NULL,
    stage_id UUID,
    expires_at TIMESTAMP,
    downloaded_count INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_tenant_id ON artifacts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_run_id ON artifacts (run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_stage_id ON artifacts (stage_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_expires_at ON artifacts (expires_at) WHERE expires_at IS NOT NULL;

-- Additional indexes for build filtering
CREATE INDEX IF NOT EXISTS idx_builds_project_id ON builds (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_builds_pipeline_run_id ON builds (pipeline_run_id) WHERE pipeline_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_builds_status ON builds (status);
