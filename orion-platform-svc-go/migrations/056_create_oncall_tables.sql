-- Migration: 001_create_oncall_tables.sql
-- Purpose: Create oncall scheduling tables for on-call rotation management

-- On-call schedules
CREATE TABLE IF NOT EXISTS oncall_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name            VARCHAR(255) NOT NULL,
    timezone        VARCHAR(50) NOT NULL DEFAULT 'UTC',
    rotation_type   VARCHAR(50) NOT NULL DEFAULT 'daily',
    start_date      DATE,
    end_date        DATE,
    status          VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- On-call assignments (rotations within a schedule)
CREATE TABLE IF NOT EXISTS oncall_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id     UUID NOT NULL REFERENCES oncall_schedules(id) ON DELETE CASCADE,
    assignee_id     VARCHAR(255) NOT NULL,
    assignee_name   VARCHAR(255) NOT NULL,
    role            VARCHAR(100) NOT NULL DEFAULT 'primary',
    start_time      TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time        TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- On-call overrides (temporary substitutions)
CREATE TABLE IF NOT EXISTS oncall_overrides (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id     UUID NOT NULL REFERENCES oncall_schedules(id) ON DELETE CASCADE,
    assignee_id     VARCHAR(255) NOT NULL,
    assignee_name   VARCHAR(255) NOT NULL,
    reason          TEXT,
    start_time      TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time        TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for tenant filtering and lookups
CREATE INDEX IF NOT EXISTS idx_oncall_schedules_tenant_id ON oncall_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oncall_assignments_schedule_id ON oncall_assignments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_oncall_assignments_assignee_id ON oncall_assignments(assignee_id);
CREATE INDEX IF NOT EXISTS idx_oncall_overrides_schedule_id ON oncall_overrides(schedule_id);
CREATE INDEX IF NOT EXISTS idx_oncall_overrides_assignee_id ON oncall_overrides(assignee_id);
CREATE INDEX IF NOT EXISTS idx_oncall_assignments_time_range ON oncall_assignments(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_oncall_overrides_time_range ON oncall_overrides(start_time, end_time);
