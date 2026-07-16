-- Migration 043: Plugin Execution Tracking

CREATE TABLE IF NOT EXISTS plugin_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id       VARCHAR(200) NOT NULL,
  action          VARCHAR(100) NOT NULL,
  input           JSONB NOT NULL DEFAULT '{}',
  output          JSONB,
  status          VARCHAR(20) NOT NULL DEFAULT 'running',
  started_by      UUID,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  duration_ms     BIGINT
);
CREATE INDEX idx_plugin_executions_plugin ON plugin_executions(plugin_id);
CREATE INDEX idx_plugin_executions_status ON plugin_executions(status);
CREATE INDEX idx_plugin_executions_started ON plugin_executions(started_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS plugin_executions;
