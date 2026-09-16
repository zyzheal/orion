-- 648_create_smart_deploy_missing_tables.sql
-- smart-deploy 模块: deployment_audit_log 表无 CREATE TABLE。
-- 注: 602 已建 deployment_audit_logs (复数)，但代码引用的是单数 deployment_audit_log。
-- 此处按代码实际引用的单数建表，不改动 602 的复数表。
-- 回滚见 648_create_smart_deploy_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS deployment_audit_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    deployment_id  UUID NOT NULL,
    action         TEXT NOT NULL DEFAULT '',
    performed_by   TEXT NOT NULL DEFAULT '',
    details        TEXT NOT NULL DEFAULT '',
    timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deployment_audit_log_tenant ON deployment_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deployment_audit_log_deployment ON deployment_audit_log(deployment_id);
