-- Migration 040: Diagnostic System

CREATE TABLE IF NOT EXISTS diagnostic_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'running',
  triggered_by    UUID,
  target_type     VARCHAR(50) NOT NULL,
  target_id       UUID,
  symptoms        JSONB NOT NULL DEFAULT '[]',
  findings        JSONB,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_diagnostic_sessions_tenant ON diagnostic_sessions(tenant_id);
CREATE INDEX idx_diagnostic_sessions_status ON diagnostic_sessions(status);

CREATE TABLE IF NOT EXISTS diagnostic_agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
  agent_type      VARCHAR(100) NOT NULL,
  analysis_result JSONB NOT NULL,
  confidence      DECIMAL(3,2),
  recommendations TEXT[] NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_diagnostic_agents_session ON diagnostic_agents(session_id);

CREATE TABLE IF NOT EXISTS metric_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_name     VARCHAR(200) NOT NULL,
  metric_value    DECIMAL(20,6) NOT NULL,
  labels          JSONB NOT NULL DEFAULT '{}',
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_metric_data_tenant ON metric_data(tenant_id);
CREATE INDEX idx_metric_data_name ON metric_data(metric_name);
CREATE INDEX idx_metric_data_timestamp ON metric_data(timestamp DESC);

-- Rollback:
-- DROP TABLE IF EXISTS metric_data, diagnostic_agents, diagnostic_sessions;
