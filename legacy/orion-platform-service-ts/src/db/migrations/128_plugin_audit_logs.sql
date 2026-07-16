-- Migration 128: Plugin Audit Logs
-- 记录插件执行审计日志，支持 7 天保留策略

CREATE TABLE IF NOT EXISTS plugin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id VARCHAR(255) NOT NULL,
    plugin_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,  -- 'execute', 'install', 'approve', 'uninstall'
    outcome VARCHAR(20) NOT NULL, -- 'success', 'failed', 'timeout', 'cancelled'
    duration_ms INTEGER,
    isolation_tier VARCHAR(20),   -- 'TIER_1', 'TIER_2', 'TIER_3', 'TIER_4'
    approval_id VARCHAR(255),
    code_hash VARCHAR(64),        -- SHA-256 hash of script code (for inline scripts)
    permissions JSONB,            -- 执行的权限配置快照
    result_data JSONB,            -- 执行结果摘要（脱敏）
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_task ON plugin_audit_logs(task_id);
CREATE INDEX idx_audit_plugin ON plugin_audit_logs(plugin_id);
CREATE INDEX idx_audit_tenant ON plugin_audit_logs(tenant_id);
CREATE INDEX idx_audit_created ON plugin_audit_logs(created_at);
CREATE INDEX idx_audit_action ON plugin_audit_logs(action);

COMMENT ON TABLE plugin_audit_logs IS 'Plugin execution audit logs for compliance and security';

-- Enable RLS
ALTER TABLE plugin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_tenant_isolation ON plugin_audit_logs
    USING (app.current_tenant_id IS NOT NULL AND app.current_tenant_id::uuid = tenant_id);
