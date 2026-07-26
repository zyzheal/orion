-- Compliance reports table
CREATE TABLE IF NOT EXISTS compliance_reports (
    id            VARCHAR(255) PRIMARY KEY,
    tenant_id     VARCHAR(255) NOT NULL,
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    framework     VARCHAR(100) NOT NULL,
    status        VARCHAR(50) NOT NULL DEFAULT 'draft',
    score         DOUBLE PRECISION,
    findings      JSONB DEFAULT '[]'::jsonb,
    schedule_id   VARCHAR(255),
    triggered_by  VARCHAR(255) NOT NULL,
    started_at    TIMESTAMP WITH TIME ZONE,
    completed_at  TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant_id ON compliance_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_framework ON compliance_reports(framework);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_status ON compliance_reports(status);

-- Compliance schedules table
CREATE TABLE IF NOT EXISTS compliance_schedules (
    id              VARCHAR(255) PRIMARY KEY,
    tenant_id       VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    framework       VARCHAR(100) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    last_run_at     TIMESTAMP WITH TIME ZONE,
    next_run_at     TIMESTAMP WITH TIME ZONE,
    created_by      VARCHAR(255),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_schedules_tenant_id ON compliance_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_schedules_framework ON compliance_schedules(framework);
CREATE INDEX IF NOT EXISTS idx_compliance_schedules_enabled ON compliance_schedules(enabled);
