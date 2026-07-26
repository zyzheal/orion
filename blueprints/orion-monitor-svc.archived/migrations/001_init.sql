-- Migration 001: Monitor Service Core Tables
-- Creates all core tables for monitoring rules, alerts, self-healing, and on-call schedules
-- Version: 1.0.0

-- ==================== Monitoring Rules ====================
CREATE TABLE IF NOT EXISTS monitoring_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  project_id      UUID NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  rule_type       VARCHAR(50) NOT NULL,
  metric_name     VARCHAR(255) NOT NULL,
  metric_type     VARCHAR(50) NOT NULL DEFAULT 'gauge',
  aggregation     VARCHAR(20) NOT NULL DEFAULT 'avg',
  threshold       DECIMAL(20, 4) NOT NULL,
  comparison      VARCHAR(10) NOT NULL,
  duration        INTEGER NOT NULL DEFAULT 60,
  labels          JSONB NOT NULL DEFAULT '{}',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  alert_policy_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      VARCHAR(255) NOT NULL
);

CREATE INDEX idx_monitoring_rules_tenant ON monitoring_rules(tenant_id);
CREATE INDEX idx_monitoring_rules_project ON monitoring_rules(project_id);
CREATE INDEX idx_monitoring_rules_enabled ON monitoring_rules(enabled);
CREATE INDEX idx_monitoring_rules_rule_type ON monitoring_rules(rule_type);

-- ==================== Alerts ====================
CREATE TABLE IF NOT EXISTS alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  project_id      UUID NOT NULL,
  rule_id         VARCHAR(255) NOT NULL,
  rule_name       VARCHAR(255) NOT NULL,
  severity        VARCHAR(20) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  triggered_at    TIMESTAMPTZ NOT NULL,
  resolved_at     TIMESTAMPTZ,
  current_value   DECIMAL(20, 4) NOT NULL DEFAULT 0,
  threshold       DECIMAL(20, 4) NOT NULL DEFAULT 0,
  message         TEXT,
  ticket_id       UUID,
  assignee_id     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      VARCHAR(255) NOT NULL
);

CREATE INDEX idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX idx_alerts_project ON alerts(project_id);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_triggered_at ON alerts(triggered_at);

-- ==================== Alert Subscriptions ====================
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  user_id         UUID NOT NULL,
  channels        JSONB NOT NULL,
  filters         JSONB,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_subscriptions_tenant ON alert_subscriptions(tenant_id);
CREATE INDEX idx_alert_subscriptions_user ON alert_subscriptions(user_id);

-- ==================== Self-Healing Policies ====================
CREATE TABLE IF NOT EXISTS self_healing_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  project_id      UUID NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  rule_id         VARCHAR(255) NOT NULL,
  action_type     VARCHAR(50) NOT NULL,
  action_config   JSONB NOT NULL DEFAULT '{}',
  cooldown_seconds INTEGER NOT NULL DEFAULT 300,
  max_retries     INTEGER NOT NULL DEFAULT 3,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  approval_required BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      VARCHAR(255) NOT NULL
);

CREATE INDEX idx_self_healing_policies_tenant ON self_healing_policies(tenant_id);
CREATE INDEX idx_self_healing_policies_project ON self_healing_policies(project_id);
CREATE INDEX idx_self_healing_policies_enabled ON self_healing_policies(enabled);

-- ==================== Self-Healing Runs ====================
CREATE TABLE IF NOT EXISTS self_healing_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  project_id      UUID NOT NULL,
  policy_id       UUID NOT NULL,
  policy_name     VARCHAR(255) NOT NULL,
  alert_id        UUID NOT NULL,
  action_type     VARCHAR(50) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts        INTEGER NOT NULL DEFAULT 0,
  input           JSONB NOT NULL DEFAULT '{}',
  output          JSONB,
  error           TEXT,
  started_at      TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      VARCHAR(255) NOT NULL
);

CREATE INDEX idx_self_healing_runs_tenant ON self_healing_runs(tenant_id);
CREATE INDEX idx_self_healing_runs_policy ON self_healing_runs(policy_id);
CREATE INDEX idx_self_healing_runs_status ON self_healing_runs(status);
CREATE INDEX idx_self_healing_runs_started_at ON self_healing_runs(started_at);

-- ==================== On-Call Schedules ====================
CREATE TABLE IF NOT EXISTS oncall_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  project_id      UUID NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  rotation_type   VARCHAR(20) NOT NULL,
  rotation_start  TIMESTAMPTZ NOT NULL,
  rotation_duration_hours INTEGER NOT NULL DEFAULT 24,
  layers          JSONB NOT NULL,
  time_zone       VARCHAR(50) NOT NULL DEFAULT 'Asia/Shanghai',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      VARCHAR(255) NOT NULL
);

CREATE INDEX idx_oncall_schedules_tenant ON oncall_schedules(tenant_id);
CREATE INDEX idx_oncall_schedules_project ON oncall_schedules(project_id);
CREATE INDEX idx_oncall_schedules_enabled ON oncall_schedules(enabled);

-- ==================== Cache Monitor ====================
CREATE TABLE IF NOT EXISTS cache_monitor_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  cache_name      VARCHAR(255) NOT NULL,
  hit_count       BIGINT NOT NULL DEFAULT 0,
  miss_count      BIGINT NOT NULL DEFAULT 0,
  eviction_count  BIGINT NOT NULL DEFAULT 0,
  avg_ttl         DECIMAL(10, 2),
  memory_usage    BIGINT,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cache_monitor_metrics_tenant ON cache_monitor_metrics(tenant_id);
CREATE INDEX idx_cache_monitor_metrics_cache ON cache_monitor_metrics(cache_name);
CREATE INDEX idx_cache_monitor_metrics_recorded_at ON cache_monitor_metrics(recorded_at);

-- ==================== Migration Info ====================
CREATE TABLE IF NOT EXISTS monitor_schema_migrations (
  version             VARCHAR(20) PRIMARY KEY,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  description         TEXT
);

INSERT INTO monitor_schema_migrations (version, description) VALUES ('001', 'Initial Monitor tables');