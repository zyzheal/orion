-- Migration: 351_create_inspection_tables.sql
-- Purpose: Persist inspection module (rules, tasks, results, reports)

-- Inspection Rules
CREATE TABLE IF NOT EXISTS inspection_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    target          VARCHAR(100) NOT NULL,          -- host, service, database, network, custom
    check_type      VARCHAR(50) NOT NULL,            -- cpu, memory, disk, network, service, custom
    threshold       NUMERIC NOT NULL,
    operator        VARCHAR(5) NOT NULL,             -- gt, lt, eq, gte, lte
    enabled         BOOLEAN DEFAULT TRUE,
    schedule        VARCHAR(100),                    -- cron expression
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_rule_tenant ON inspection_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inspection_rule_enabled ON inspection_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_inspection_rule_target ON inspection_rules(target);

-- Inspection Tasks
CREATE TABLE IF NOT EXISTS inspection_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    rule_id         UUID NOT NULL REFERENCES inspection_rules(id),
    status          VARCHAR(20) DEFAULT 'pending',   -- pending, running, completed, failed
    result_id       UUID,                            -- FK to inspection_results
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_task_rule ON inspection_tasks(rule_id);
CREATE INDEX IF NOT EXISTS idx_inspection_task_tenant ON inspection_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inspection_task_status ON inspection_tasks(status);

-- Inspection Results
CREATE TABLE IF NOT EXISTS inspection_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES inspection_tasks(id),
    passed          BOOLEAN NOT NULL,
    actual_value    NUMERIC NOT NULL,
    expected_value  NUMERIC NOT NULL,
    message         TEXT NOT NULL,
    details         JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_result_task ON inspection_results(task_id);

-- Inspection Reports
CREATE TABLE IF NOT EXISTS inspection_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    title           VARCHAR(200) NOT NULL,
    summary         JSONB NOT NULL,                 -- {total, passed, failed, warning, score}
    generated_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inspection_report_tenant ON inspection_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inspection_report_generated ON inspection_reports(generated_at DESC);
