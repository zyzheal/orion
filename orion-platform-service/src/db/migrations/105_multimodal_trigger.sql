-- 105: Multimodal Trigger
-- 触发器定义、触发器执行、Webhook 注册

-- trigger_definitions 表（触发器定义）
CREATE TABLE IF NOT EXISTS trigger_definitions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger_name      VARCHAR(200) NOT NULL,
  trigger_type      VARCHAR(50) NOT NULL,                      -- webhook, schedule, event, manual, metric, code_change
  description       TEXT,
  event_source      VARCHAR(100),
  event_filter      JSONB NOT NULL DEFAULT '{}',
  payload_schema    JSONB NOT NULL DEFAULT '{}',
  action_type       VARCHAR(50) NOT NULL,                      -- pipeline_run, notification, approval, custom
  action_config     JSONB NOT NULL DEFAULT '{}',
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trigger_definitions_tenant ON trigger_definitions(tenant_id);
CREATE INDEX idx_trigger_definitions_type ON trigger_definitions(trigger_type);
CREATE INDEX idx_trigger_definitions_enabled ON trigger_definitions(enabled) WHERE enabled = true;
CREATE INDEX idx_trigger_definitions_action ON trigger_definitions(action_type);

-- trigger_executions 表（触发器执行记录）
CREATE TABLE IF NOT EXISTS trigger_executions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger_id        UUID NOT NULL REFERENCES trigger_definitions(id) ON DELETE CASCADE,
  execution_id      VARCHAR(100) NOT NULL,
  trigger_event     JSONB NOT NULL DEFAULT '{}',
  status            VARCHAR(30) NOT NULL DEFAULT 'pending',    -- pending, running, completed, failed, skipped
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  result            JSONB NOT NULL DEFAULT '{}',
  error_message     TEXT,
  duration_ms       INT
);
CREATE INDEX idx_trigger_executions_tenant ON trigger_executions(tenant_id);
CREATE INDEX idx_trigger_executions_trigger ON trigger_executions(trigger_id);
CREATE INDEX idx_trigger_executions_status ON trigger_executions(status);
CREATE INDEX idx_trigger_executions_started ON trigger_executions(started_at DESC);

-- webhook_registrations 表（Webhook 注册）
CREATE TABLE IF NOT EXISTS webhook_registrations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger_id        UUID REFERENCES trigger_definitions(id) ON DELETE SET NULL,
  webhook_url       VARCHAR(1000) NOT NULL,
  secret            VARCHAR(200),
  events            JSONB NOT NULL DEFAULT '[]',
  content_type      VARCHAR(50) NOT NULL DEFAULT 'application/json',
  headers           JSONB NOT NULL DEFAULT '{}',
  retry_policy      JSONB NOT NULL DEFAULT '{"max_retries": 3, "backoff": "exponential"}',
  ssl_verify        BOOLEAN NOT NULL DEFAULT true,
  active            BOOLEAN NOT NULL DEFAULT true,
  last_delivery_at  TIMESTAMPTZ,
  last_delivery_status VARCHAR(30),
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_registrations_tenant ON webhook_registrations(tenant_id);
CREATE INDEX idx_webhook_registrations_trigger ON webhook_registrations(trigger_id);
CREATE INDEX idx_webhook_registrations_active ON webhook_registrations(active) WHERE active = true;

-- RLS
ALTER TABLE trigger_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trigger_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_trigger_definitions ON trigger_definitions
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_trigger_executions ON trigger_executions
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_webhook_registrations ON webhook_registrations
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
