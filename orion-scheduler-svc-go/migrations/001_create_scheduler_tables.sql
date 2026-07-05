-- ═══════════════════════════════════════════════════════════════════════════
-- Scheduler Service — DDL
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Cron Jobs ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'cron',
    cron_expr VARCHAR(100),
    interval_sec INT,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    run_count INT NOT NULL DEFAULT 0,
    max_runs INT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_id ON jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_next_run ON jobs(next_run_at) WHERE status = 'active';

-- ── Job Runs ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_ms BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_id ON job_runs(job_id);

-- ── On-Call Schedules ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS oncall_schedules (
    id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    rotation_type VARCHAR(20) NOT NULL DEFAULT 'daily',
    rotation_start_hour INT NOT NULL DEFAULT 9,
    team_members JSONB NOT NULL DEFAULT '[]',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    escalations JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oncall_schedules_name ON oncall_schedules(name);

-- ── On-Call Assignments ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS oncall_assignments (
    id VARCHAR(128) PRIMARY KEY,
    schedule_id VARCHAR(128) NOT NULL REFERENCES oncall_schedules(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oncall_assignments_schedule ON oncall_assignments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_oncall_assignments_time ON oncall_assignments(schedule_id, start_time, end_time);

-- ── On-Call Overrides ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS oncall_overrides (
    id VARCHAR(128) PRIMARY KEY,
    schedule_id VARCHAR(128) NOT NULL REFERENCES oncall_schedules(id) ON DELETE CASCADE,
    original_user_id VARCHAR(128) NOT NULL,
    override_user_id VARCHAR(128) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_oncall_overrides_schedule ON oncall_overrides(schedule_id);
CREATE INDEX IF NOT EXISTS idx_oncall_overrides_time ON oncall_overrides(schedule_id, start_time, end_time);
