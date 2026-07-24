-- Migration 417: Create alert notification trigger support tables
-- 告警通知自动触发：支持通知模板、去重窗口、升级历史

-- ==================== 通知模板表 ====================
CREATE TABLE IF NOT EXISTS alert_notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  -- 适用范围
  severity_filter TEXT[] NOT NULL DEFAULT '{}',  -- ['critical','high','medium','low','info']
  channel_type VARCHAR(50) NOT NULL,             -- 'email','sms','webhook','slack','in-app'
  -- 模板内容
  subject_template TEXT,                         -- 标题模板（支持 {ruleName}, {severity}, {metric}, {value}, {threshold}, {message}）
  body_template TEXT NOT NULL,                   -- 正文模板
  -- 渠道参数覆盖（JSONB，可覆盖渠道默认配置）
  channel_overrides JSONB DEFAULT '{}'::jsonb,
  -- 控制
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,     -- 是否为默认模板
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(200),
  CONSTRAINT chk_channel_type CHECK (channel_type IN ('email','sms','webhook','slack','in-app'))
);

-- ==================== 通知去重跟踪表 ====================
-- 跟踪已发送的通知，防止在时间窗口内重复发送
CREATE TABLE IF NOT EXISTS alert_notification_dedup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  alert_fingerprint VARCHAR(200) NOT NULL,
  alert_id VARCHAR(200) NOT NULL,
  channel_type VARCHAR(50) NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notification_id UUID,                          -- 关联的通知记录ID
  CONSTRAINT chk_dedup_channel CHECK (channel_type IN ('email','sms','webhook','slack','in-app'))
);

-- ==================== 升级历史表 ====================
-- 记录告警升级过程
CREATE TABLE IF NOT EXISTS alert_escalation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  alert_id VARCHAR(200) NOT NULL,
  alert_fingerprint VARCHAR(200) NOT NULL,
  policy_id UUID,
  policy_name VARCHAR(200),
  from_step INTEGER NOT NULL DEFAULT 0,
  to_step INTEGER NOT NULL DEFAULT 0,
  -- 升级触发的渠道
  channels TEXT[] NOT NULL DEFAULT '{}',
  recipients TEXT[] NOT NULL DEFAULT '{}',
  -- 结果
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending','sent','failed'
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== 汇总通知批次表 ====================
-- 用于 medium 级别告警的汇总通知批处理
CREATE TABLE IF NOT EXISTS alert_notification_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_key VARCHAR(200) NOT NULL,               -- 批次标识（如 tenantId + severity + hour）
  severity VARCHAR(50) NOT NULL,                 -- 汇总的告警级别
  alert_ids TEXT[] NOT NULL DEFAULT '{}',        -- 包含的告警ID列表
  alert_count INTEGER NOT NULL DEFAULT 0,
  -- 通知渠道
  channel_type VARCHAR(50) NOT NULL DEFAULT 'email',
  recipients TEXT[] NOT NULL DEFAULT '{}',
  -- 状态
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending','sent','failed'
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_batch_severity CHECK (severity IN ('critical','high','medium','low','info')),
  CONSTRAINT chk_batch_channel CHECK (channel_type IN ('email','sms','webhook','slack','in-app'))
);

-- ==================== 索引 ====================
CREATE INDEX IF NOT EXISTS idx_alert_notif_tmpl_tenant ON alert_notification_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_notif_tmpl_severity ON alert_notification_templates(severity_filter);
CREATE INDEX IF NOT EXISTS idx_alert_notif_tmpl_channel ON alert_notification_templates(channel_type);
CREATE INDEX IF NOT EXISTS idx_alert_notif_tmpl_default ON alert_notification_templates(tenant_id, is_default) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_alert_notif_dedup_fp ON alert_notification_dedup(alert_fingerprint, sent_at);
CREATE INDEX IF NOT EXISTS idx_alert_notif_dedup_alert ON alert_notification_dedup(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_notif_dedup_tenant ON alert_notification_dedup(tenant_id);

CREATE INDEX IF NOT EXISTS idx_alert_escalation_alert ON alert_escalation_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_escalation_tenant ON alert_escalation_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_escalation_policy ON alert_escalation_history(policy_id);

CREATE INDEX IF NOT EXISTS idx_alert_notif_batch_key ON alert_notification_batches(batch_key);
CREATE INDEX IF NOT EXISTS idx_alert_notif_batch_tenant ON alert_notification_batches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_notif_batch_status ON alert_notification_batches(status);
