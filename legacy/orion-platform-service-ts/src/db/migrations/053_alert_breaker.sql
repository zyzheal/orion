-- Migration 053: Alert Breaker (告警熔断引擎)
-- 基于滑动窗口的告警频率熔断，防止告警风暴
-- 三种策略: dedup_breaker / silence_breaker / cascade_breaker

-- 1. alert_breaker_rules 表 - 熔断规则
CREATE TABLE IF NOT EXISTS alert_breaker_rules (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,

  -- 熔断策略
  strategy        VARCHAR(32) NOT NULL DEFAULT 'dedup_breaker'
                  CHECK (strategy IN ('dedup_breaker', 'silence_breaker', 'cascade_breaker')),

  -- 匹配条件 (JSONB 数组，复用 AlertSilenceService 的 matcher 模式)
  matchers        JSONB NOT NULL DEFAULT '[]',

  -- 阈值配置
  threshold       INTEGER NOT NULL DEFAULT 10,
  window_seconds  INTEGER NOT NULL DEFAULT 300,
  cooldown_seconds INTEGER NOT NULL DEFAULT 600,

  -- 熔断后动作
  action          VARCHAR(32) NOT NULL DEFAULT 'suppress'
                  CHECK (action IN ('suppress', 'merge', 'downgrade')),

  -- 状态
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,

  -- 时间戳
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_alert_breaker_rules_tenant ON alert_breaker_rules(tenant_id);
CREATE INDEX idx_alert_breaker_rules_enabled ON alert_breaker_rules(tenant_id, enabled) WHERE enabled = TRUE;

-- RLS
ALTER TABLE alert_breaker_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_breaker_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_alert_breaker_rules ON alert_breaker_rules
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id = current_setting('app.current_tenant_id', true));

-- 2. alert_breaker_events 表 - 熔断触发/恢复事件日志
CREATE TABLE IF NOT EXISTS alert_breaker_events (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  rule_id         VARCHAR(64) NOT NULL REFERENCES alert_breaker_rules(id) ON DELETE CASCADE,
  rule_name       VARCHAR(255) NOT NULL,

  -- 事件类型
  event_type      VARCHAR(32) NOT NULL
                  CHECK (event_type IN ('open', 'close', 'half_open', 'manual_open', 'manual_close')),

  -- 触发详情
  trigger_count   INTEGER NOT NULL DEFAULT 0,
  trigger_fingerprint VARCHAR(64),
  action_taken    VARCHAR(32) NOT NULL DEFAULT 'suppress',
  reason          TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_breaker_events_rule ON alert_breaker_events(rule_id, created_at DESC);
CREATE INDEX idx_alert_breaker_events_tenant ON alert_breaker_events(tenant_id, created_at DESC);

-- RLS
ALTER TABLE alert_breaker_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_breaker_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_alert_breaker_events ON alert_breaker_events
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id = current_setting('app.current_tenant_id', true));
