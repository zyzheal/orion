-- Migration 003: Phase Groups and Batch Runs

-- Phase groups: groups of pipeline phases/stages for batch execution
CREATE TABLE IF NOT EXISTS phase_groups (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL,
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    pipeline_ids  JSONB NOT NULL DEFAULT '[]',
    config        JSONB DEFAULT '{}',
    status        VARCHAR(30) NOT NULL DEFAULT 'active',
    created_by    VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_phase_groups_tenant ON phase_groups(tenant_id);
CREATE INDEX idx_phase_groups_status ON phase_groups(status);

-- Phase group execution records
CREATE TABLE IF NOT EXISTS phase_group_runs (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phase_group_id UUID NOT NULL REFERENCES phase_groups(id) ON DELETE CASCADE,
    tenant_id      UUID NOT NULL,
    pipeline_ids   JSONB NOT NULL DEFAULT '[]',
    status         VARCHAR(30) NOT NULL DEFAULT 'pending',
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    duration_ms    BIGINT DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_phase_group_runs_group ON phase_group_runs(phase_group_id);
CREATE INDEX idx_phase_group_runs_tenant ON phase_group_runs(tenant_id);
CREATE INDEX idx_phase_group_runs_status ON phase_group_runs(status);

-- Batch runs: one-time batch execution of pipelines
CREATE TABLE IF NOT EXISTS batch_runs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    UUID NOT NULL,
    pipeline_ids JSONB NOT NULL DEFAULT '[]',
    count        INT NOT NULL DEFAULT 0,
    status       VARCHAR(30) NOT NULL DEFAULT 'pending',
    started_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms  BIGINT DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_batch_runs_tenant ON batch_runs(tenant_id);
CREATE INDEX idx_batch_runs_status ON batch_runs(status);