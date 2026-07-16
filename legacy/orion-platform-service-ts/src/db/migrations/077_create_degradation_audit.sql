-- orion-platform-service/src/db/migrations/077_create_degradation_audit.sql
-- 降级审计日志表

CREATE TABLE IF NOT EXISTS degradation_audit_logs (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    degradation_type VARCHAR(32) NOT NULL,
    scenario_id VARCHAR(64),
    provider_id VARCHAR(64),
    trigger_reason VARCHAR(64) NOT NULL,
    trigger_threshold DECIMAL(5,4),
    actual_value DECIMAL(5,4),
    degradation_action VARCHAR(32) NOT NULL,
    fallback_provider VARCHAR(64),
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recovered_at TIMESTAMP WITH TIME ZONE,
    recovery_trigger VARCHAR(64),
    duration_seconds INTEGER,
    affected_requests INTEGER DEFAULT 0,
    success_rate_before DECIMAL(5,4),
    success_rate_after DECIMAL(5,4),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_degradation_audit_tenant ON degradation_audit_logs(tenant_id);
CREATE INDEX idx_degradation_audit_type ON degradation_audit_logs(degradation_type);
CREATE INDEX idx_degradation_audit_triggered ON degradation_audit_logs(triggered_at);

COMMENT ON TABLE degradation_audit_logs IS '降级决策审计日志';