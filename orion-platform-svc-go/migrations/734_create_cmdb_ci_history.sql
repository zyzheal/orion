-- Migration 734: CMDB CI History — 配置项变更记录
CREATE TABLE IF NOT EXISTS cmdb_ci_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    ci_id           UUID NOT NULL,
    changed_field   TEXT NOT NULL,
    old_value       TEXT,
    new_value       TEXT,
    changed_by      TEXT NOT NULL DEFAULT 'system',
    change_type     TEXT NOT NULL DEFAULT 'update',
    -- create, update, delete, attribute_change
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cmdb_ci_history_ci ON cmdb_ci_history(ci_id, created_at DESC);
CREATE INDEX idx_cmdb_ci_history_tenant ON cmdb_ci_history(tenant_id);
