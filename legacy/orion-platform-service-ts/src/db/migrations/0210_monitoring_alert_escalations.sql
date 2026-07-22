-- Monitoring Alert Escalations table
-- 记录告警升级的完整状态变更历史，支持审计和追溯

CREATE TABLE IF NOT EXISTS monitoring_alert_escalations (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  alert_id VARCHAR(36) NOT NULL,
  rule_id VARCHAR(36) NOT NULL,
  policy_id VARCHAR(36),
  from_status VARCHAR(32) NOT NULL,
  to_status VARCHAR(32) NOT NULL,
  escalation_step INTEGER,
  channel_ids TEXT[],
  recipients TEXT[],
  triggered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_escalations_alert_id ON monitoring_alert_escalations(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_escalations_rule_id ON monitoring_alert_escalations(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_escalations_tenant_id ON monitoring_alert_escalations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_escalations_triggered_at ON monitoring_alert_escalations(triggered_at);

COMMENT ON TABLE monitoring_alert_escalations IS '告警升级状态变更历史';
COMMENT ON COLUMN monitoring_alert_escalations.from_status IS '升级前状态';
COMMENT ON COLUMN monitoring_alert_escalations.to_status IS '升级后状态';
COMMENT ON COLUMN monitoring_alert_escalations.escalation_step IS '升级步骤序号（0-based）';
COMMENT ON COLUMN monitoring_alert_escalations.channel_ids IS '通知渠道 ID 列表';
COMMENT ON COLUMN monitoring_alert_escalations.recipients IS '收件人列表';
COMMENT ON COLUMN monitoring_alert_escalations.triggered_at IS '升级触发时间';
COMMENT ON COLUMN monitoring_alert_escalations.completed_at IS '升级完成时间';
COMMENT ON COLUMN monitoring_alert_escalations.error_message IS '升级失败错误信息';
