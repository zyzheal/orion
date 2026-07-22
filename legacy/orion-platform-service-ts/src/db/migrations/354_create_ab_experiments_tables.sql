-- Migration: 354_create_ab_experiments_tables.sql
-- Purpose: Persist A/B experiment module (experiments + variants tracked within JSONB)

CREATE TABLE IF NOT EXISTS ab_experiments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name            VARCHAR(200) NOT NULL,
    description     TEXT DEFAULT '',
    hypothesis      TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, running, completed, cancelled
    variants        JSONB NOT NULL DEFAULT '[]',
    metrics         JSONB NOT NULL DEFAULT '[]',
    start_date      TIMESTAMPTZ,
    end_date        TIMESTAMPTZ,
    created_by      VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    results         JSONB
);

CREATE INDEX IF NOT EXISTS idx_ab_experiments_tenant ON ab_experiments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_status ON ab_experiments(status);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_created_at ON ab_experiments(created_at DESC);
