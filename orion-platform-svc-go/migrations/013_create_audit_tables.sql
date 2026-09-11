-- Audit module tables

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    request_method VARCHAR(20),
    request_path VARCHAR(255),
    request_body JSONB,
    response_code BIGINT DEFAULT 0,
    response_body JSONB,
    ip_address VARCHAR(255),
    user_agent VARCHAR(255),
    prev_hash VARCHAR(255),
    hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
-- 补齐 audit_logs：154_create_pipeline-audit-log_tables.sql 的定义晚于 013_create_audit_tables.sql，按序执行时表已存在
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS run_id VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS stage_id VARCHAR(255), ADD COLUMN IF NOT EXISTS task_id VARCHAR(255), ADD COLUMN IF NOT EXISTS actor VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS outcome VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS duration_ms BIGINT, ADD COLUMN IF NOT EXISTS input_summary VARCHAR(255), ADD COLUMN IF NOT EXISTS output_summary VARCHAR(255), ADD COLUMN IF NOT EXISTS error_message VARCHAR(255), ADD COLUMN IF NOT EXISTS metadata VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;


CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
