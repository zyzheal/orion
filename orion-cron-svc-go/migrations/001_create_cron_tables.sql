-- ============================================================
-- Cron & OnCall Service Schema
-- Ported from orion-platform-service/src/services/scheduler/
-- ============================================================

-- ── Cron Jobs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cron_jobs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    schedule VARCHAR(128) NOT NULL,
    command TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    last_run_status VARCHAR(32),
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_tenant ON cron_jobs(tenant_id, enabled);

-- ── Cron Executions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cron_executions (
    id VARCHAR(128) PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'running',
    output TEXT,
    error TEXT
);
CREATE INDEX IF NOT EXISTS idx_cron_executions_job ON cron_executions(job_id, started_at DESC);

-- ── OnCall Schedules ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oncall_schedules (
    id VARCHAR(128) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    rotation_type VARCHAR(32) NOT NULL DEFAULT 'daily',
    rotation_start_hour INT NOT NULL DEFAULT 9,
    team_members JSONB NOT NULL DEFAULT '[]',
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    escalations JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oncall_schedules_tenant ON oncall_schedules(tenant_id);

-- ── OnCall Assignments ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS oncall_assignments (
    id VARCHAR(128) PRIMARY KEY,
    schedule_id VARCHAR(128) NOT NULL REFERENCES oncall_schedules(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oncall_assignments_schedule ON oncall_assignments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_oncall_assignments_time ON oncall_assignments(schedule_id, start_time, end_time);

-- ── OnCall Overrides ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oncall_overrides (
    id VARCHAR(128) PRIMARY KEY,
    schedule_id VARCHAR(128) NOT NULL REFERENCES oncall_schedules(id) ON DELETE CASCADE,
    original_user_id VARCHAR(128) NOT NULL,
    override_user_id VARCHAR(128) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_oncall_overrides_schedule ON oncall_overrides(schedule_id);
CREATE INDEX IF NOT EXISTS idx_oncall_overrides_time ON oncall_overrides(schedule_id, start_time, end_time);
