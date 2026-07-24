-- Deploy Enhanced tables (Deploy Windows, Progressive Deploys, Emergency Deploys)
-- Created: 2026-07-12

CREATE TABLE IF NOT EXISTS deploy_windows (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name VARCHAR(255) NOT NULL,
    environment_id VARCHAR(255),
    type VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    cron_expression VARCHAR(128),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 60,
    timezone VARCHAR(64) DEFAULT 'Asia/Shanghai',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by VARCHAR(255) DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS progressive_deploys (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    deployment_id VARCHAR(255) NOT NULL,
    strategy VARCHAR(32) NOT NULL DEFAULT 'gradual',
    stages JSONB NOT NULL DEFAULT '[]',
    current_stage INTEGER DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    rollback_enabled BOOLEAN DEFAULT true,
    rollback_stage VARCHAR(255),
    rollback_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emergency_deploys (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    deployment_id VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    requested_by VARCHAR(255) NOT NULL,
    approved_by VARCHAR(255),
    urgency VARCHAR(32) DEFAULT 'high',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    post_mortem TEXT,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deploy_windows_tenant ON deploy_windows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deploy_windows_status ON deploy_windows(status);
CREATE INDEX IF NOT EXISTS idx_deploy_windows_type ON deploy_windows(type);
CREATE INDEX IF NOT EXISTS idx_deploy_windows_environment ON deploy_windows(environment_id);

CREATE INDEX IF NOT EXISTS idx_progressive_deploys_tenant ON progressive_deploys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_progressive_deploys_status ON progressive_deploys(status);
CREATE INDEX IF NOT EXISTS idx_progressive_deploys_deployment ON progressive_deploys(deployment_id);

CREATE INDEX IF NOT EXISTS idx_emergency_deploys_tenant ON emergency_deploys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emergency_deploys_status ON emergency_deploys(status);
CREATE INDEX IF NOT EXISTS idx_emergency_deploys_deployment ON emergency_deploys(deployment_id);
