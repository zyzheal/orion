-- Migration: 359_create_cross_domain_orchestration_tables.sql
-- Purpose: Persist cross-domain orchestration (orchestrations and their steps)

-- Cross-Domain Orchestrations
CREATE TABLE IF NOT EXISTS cross_domain_orchestrations (
    id              VARCHAR(50) PRIMARY KEY,
    tenant_id       VARCHAR(50) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    status          VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending, running, paused, completed, failed, aborted, compensating, compensated
    input           JSONB NOT NULL DEFAULT '{}',
    output          JSONB,
    error           TEXT,
    domains         JSONB NOT NULL DEFAULT '[]',
    current_step    VARCHAR(200),
    step_count      INTEGER NOT NULL DEFAULT 0,
    completed_steps INTEGER NOT NULL DEFAULT 0,
    created_by      VARCHAR(100),
    metadata        JSONB NOT NULL DEFAULT '{}',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cdo_tenant ON cross_domain_orchestrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cdo_status ON cross_domain_orchestrations(status);
CREATE INDEX IF NOT EXISTS idx_cdo_created ON cross_domain_orchestrations(created_at DESC);

-- Orchestration Steps
CREATE TABLE IF NOT EXISTS cross_domain_orchestration_steps (
    id                      VARCHAR(50) NOT NULL,
    orchestration_id        VARCHAR(50) NOT NULL REFERENCES cross_domain_orchestrations(id) ON DELETE CASCADE,
    step_name               VARCHAR(200) NOT NULL,
    domain_name             VARCHAR(200) NOT NULL,
    sequence                INTEGER NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, executing, completed, failed, compensating, compensated, skipped
    input                   JSONB NOT NULL DEFAULT '{}',
    output                  JSONB,
    error                   TEXT,
    retry_count             INTEGER NOT NULL DEFAULT 0,
    max_retries             INTEGER NOT NULL DEFAULT 3,
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    compensation_started_at TIMESTAMPTZ,
    compensation_completed_at TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (orchestration_id, step_name, sequence)
);

CREATE INDEX IF NOT EXISTS idx_cdos_orchestration ON cross_domain_orchestration_steps(orchestration_id);
CREATE INDEX IF NOT EXISTS idx_cdos_domain ON cross_domain_orchestration_steps(domain_name);
