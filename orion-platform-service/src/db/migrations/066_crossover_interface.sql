-- Migration 066: Crossover Interface Registry (Migration 339)
-- 跨模块接口层：接口注册、调用日志

-- 1. crossover_interface 表
CREATE TABLE IF NOT EXISTS crossover_interface (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  interface_key   VARCHAR(255) NOT NULL,
  version         VARCHAR(32) NOT NULL DEFAULT 'v1',
  source_service  VARCHAR(128) NOT NULL,
  target_service  VARCHAR(128),
  interface_type  VARCHAR(16) NOT NULL DEFAULT 'sync',  -- sync/async
  config          JSONB DEFAULT '{}',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_by      VARCHAR(64),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, interface_key, version)
);

-- RLS 多租户隔离
ALTER TABLE crossover_interface ENABLE ROW LEVEL SECURITY;
ALTER TABLE crossover_interface FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crossover_interface USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_crossover_interface_tenant ON crossover_interface(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crossover_interface_key ON crossover_interface(interface_key);
CREATE INDEX IF NOT EXISTS idx_crossover_interface_enabled ON crossover_interface(enabled);

-- 2. crossover_call_log 表
CREATE TABLE IF NOT EXISTS crossover_call_log (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  interface_id    VARCHAR(64),
  interface_key   VARCHAR(255) NOT NULL,
  caller_service  VARCHAR(128) NOT NULL,
  callee_service  VARCHAR(128) NOT NULL,
  request_data    JSONB,
  response_data   JSONB,
  status          VARCHAR(16) NOT NULL,   -- success/failed/timeout
  duration_ms     INTEGER NOT NULL,
  error_message   TEXT,
  trace_id        VARCHAR(64),
  depth           INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RLS 多租户隔离
ALTER TABLE crossover_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE crossover_call_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crossover_call_log USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_crossover_log_tenant ON crossover_call_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crossover_log_interface ON crossover_call_log(interface_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crossover_log_trace ON crossover_call_log(trace_id);
CREATE INDEX IF NOT EXISTS idx_crossover_log_status ON crossover_call_log(status);
