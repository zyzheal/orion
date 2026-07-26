-- DR Plans: core disaster recovery plan definitions
CREATE TABLE IF NOT EXISTS dr_plans (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    plan_type VARCHAR(64) NOT NULL,
    rpo INT NOT NULL DEFAULT 3600,
    rto INT NOT NULL DEFAULT 7200,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    priority VARCHAR(32) NOT NULL DEFAULT 'medium',
    failover_strategy VARCHAR(64) NOT NULL DEFAULT 'manual',
    backup_regions JSONB DEFAULT '[]',
    services JSONB DEFAULT '[]',
    last_tested TIMESTAMPTZ,
    config JSONB DEFAULT '{}',
    created_by VARCHAR(128) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dr_plans_tenant ON dr_plans(tenant_id, created_at);

-- DR Failover Tests: records of failover tests and drills
CREATE TABLE IF NOT EXISTS dr_failover_tests (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    plan_id UUID NOT NULL REFERENCES dr_plans(id) ON DELETE CASCADE,
    test_name VARCHAR(256) NOT NULL,
    test_type VARCHAR(64) NOT NULL DEFAULT 'drill',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    actual_rto INT,
    actual_rpo INT,
    result VARCHAR(32) NOT NULL DEFAULT 'running',
    affected_services JSONB DEFAULT '[]',
    findings TEXT,
    created_by VARCHAR(128) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dr_failover_tests_tenant ON dr_failover_tests(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dr_failover_tests_plan ON dr_failover_tests(plan_id);

-- DR Backup Configs: backup configuration per source
CREATE TABLE IF NOT EXISTS dr_backup_configs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    source_type VARCHAR(64) NOT NULL,
    source_id VARCHAR(128) NOT NULL,
    backup_schedule VARCHAR(128) NOT NULL DEFAULT '0 2 * * *',
    retention_days INT NOT NULL DEFAULT 30,
    storage_location VARCHAR(512) NOT NULL,
    encryption BOOLEAN NOT NULL DEFAULT TRUE,
    compression VARCHAR(32) NOT NULL DEFAULT 'gzip',
    last_backup_at TIMESTAMPTZ,
    last_backup_size BIGINT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(128) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dr_backup_configs_tenant ON dr_backup_configs(tenant_id, created_at);

-- DR Policies: unified DR policy definitions
CREATE TABLE IF NOT EXISTS dr_policies (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    services JSONB DEFAULT '[]',
    strategy VARCHAR(64) NOT NULL DEFAULT 'active-passive',
    rpo VARCHAR(32) NOT NULL DEFAULT '1h',
    rto VARCHAR(32) NOT NULL DEFAULT '4h',
    priority INT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    project_id VARCHAR(64),
    config JSONB DEFAULT '{}',
    created_by VARCHAR(128) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dr_policies_tenant ON dr_policies(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dr_policies_strategy ON dr_policies(tenant_id, strategy);
CREATE INDEX IF NOT EXISTS idx_dr_policies_status ON dr_policies(tenant_id, status);
