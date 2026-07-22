-- Migration: 360_create_multicloud_advanced_tables.sql
-- Purpose: Persist MultiCloudAdvancedService entities (DR, CloudNetwork, SchedulingPolicy, SchedulingDecision)

-- Cross-Zone DR Configurations
CREATE TABLE IF NOT EXISTS cross_zone_dr (
    id              VARCHAR(50) PRIMARY KEY,
    tenant_id       VARCHAR(50) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    primary_zone    VARCHAR(100) NOT NULL,
    secondary_zone  VARCHAR(100) NOT NULL,
    strategy        VARCHAR(20) NOT NULL DEFAULT 'active-passive',  -- active-passive, active-active
    rpo             INTEGER NOT NULL DEFAULT 300,
    rto             INTEGER NOT NULL DEFAULT 600,
    status          VARCHAR(20) NOT NULL DEFAULT 'configured',      -- configured, testing, active, failed
    last_test_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_czdr_tenant ON cross_zone_dr(tenant_id);
CREATE INDEX IF NOT EXISTS idx_czdr_status ON cross_zone_dr(status);

-- DR Test Results
CREATE TABLE IF NOT EXISTS dr_test_results (
    id              VARCHAR(50) PRIMARY KEY,
    dr_id           VARCHAR(50) NOT NULL REFERENCES cross_zone_dr(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL,                            -- success, failed, partial
    duration        INTEGER NOT NULL DEFAULT 0,
    details         JSONB NOT NULL DEFAULT '{}',
    tested_at       TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dtr_dr ON dr_test_results(dr_id);
CREATE INDEX IF NOT EXISTS idx_dtr_tested ON dr_test_results(tested_at DESC);

-- Cloud Networks
CREATE TABLE IF NOT EXISTS cloud_networks (
    id                  VARCHAR(50) PRIMARY KEY,
    tenant_id           VARCHAR(50) NOT NULL,
    name                VARCHAR(200) NOT NULL,
    vpc_id              VARCHAR(100) NOT NULL,
    subnets             JSONB NOT NULL DEFAULT '[]',
    security_groups     JSONB NOT NULL DEFAULT '[]',
    status              VARCHAR(20) NOT NULL DEFAULT 'provisioning',  -- active, provisioning, error
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cn_tenant ON cloud_networks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cn_status ON cloud_networks(status);

-- Scheduling Policies
CREATE TABLE IF NOT EXISTS scheduling_policies (
    id              VARCHAR(50) PRIMARY KEY,
    tenant_id       VARCHAR(50) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    strategy        VARCHAR(30) NOT NULL DEFAULT 'balanced',         -- cost-optimized, performance-optimized, balanced, geo-proximity
    constraints     JSONB NOT NULL DEFAULT '{}',
    priority        INTEGER NOT NULL DEFAULT 1,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sp_tenant ON scheduling_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sp_enabled ON scheduling_policies(enabled);

-- Scheduling Decisions
CREATE TABLE IF NOT EXISTS scheduling_decisions (
    id                  VARCHAR(50) PRIMARY KEY,
    policy_id           VARCHAR(50) NOT NULL REFERENCES scheduling_policies(id) ON DELETE CASCADE,
    resource_type       VARCHAR(100) NOT NULL,
    selected_provider   VARCHAR(50) NOT NULL,
    selected_region     VARCHAR(100) NOT NULL,
    estimated_cost      FLOAT NOT NULL DEFAULT 0,
    reason              TEXT NOT NULL,
    alternatives        JSONB NOT NULL DEFAULT '[]',
    decided_at          TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sd_policy ON scheduling_decisions(policy_id);
CREATE INDEX IF NOT EXISTS idx_sd_decided ON scheduling_decisions(decided_at DESC);
