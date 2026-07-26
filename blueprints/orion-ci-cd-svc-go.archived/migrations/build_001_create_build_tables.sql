CREATE TABLE IF NOT EXISTS builds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    repo_id UUID,
    branch VARCHAR(255),
    commit_sha VARCHAR(40),
    status VARCHAR(50),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    logs TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_builds_tenant_id ON builds (tenant_id);
