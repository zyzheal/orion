-- Migration 003: Budget management and audit log tables

-- Pipeline budgets
CREATE TABLE IF NOT EXISTS pipeline_budgets (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL,
    pipeline_id   UUID REFERENCES pipelines(id) ON DELETE CASCADE,
    budget_limit  NUMERIC(15,2) NOT NULL DEFAULT 0,
    current_spend NUMERIC(15,2) NOT NULL DEFAULT 0,
    currency      VARCHAR(10) NOT NULL DEFAULT 'USD',
    period        VARCHAR(20) NOT NULL DEFAULT 'monthly',
    description   TEXT,
    created_by    VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budgets_tenant ON pipeline_budgets(tenant_id);
CREATE INDEX idx_budgets_pipeline ON pipeline_budgets(pipeline_id);

-- Pipeline audit logs
CREATE TABLE IF NOT EXISTS pipeline_audit_logs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL,
    pipeline_id   UUID REFERENCES pipelines(id) ON DELETE SET NULL,
    run_id        UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
    action        VARCHAR(100) NOT NULL,
    actor         VARCHAR(255) NOT NULL,
    target        VARCHAR(255),
    target_type   VARCHAR(50),
    details       JSONB DEFAULT '{}',
    ip_address    VARCHAR(45),
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_tenant ON pipeline_audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_pipeline ON pipeline_audit_logs(pipeline_id);
CREATE INDEX idx_audit_logs_actor ON pipeline_audit_logs(actor);
CREATE INDEX idx_audit_logs_action ON pipeline_audit_logs(action);
CREATE INDEX idx_audit_logs_created ON pipeline_audit_logs(created_at);