-- Migration 001: Audit logs
-- Audit trail for all system operations

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(200) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id   UUID,
  request_method VARCHAR(10),
  request_path  TEXT,
  request_body  JSONB,
  response_code INT,
  response_body JSONB,
  ip_address    INET,
  user_agent    TEXT,
  prev_hash     VARCHAR(64),
  hash          VARCHAR(64) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Rollback:
-- DROP TABLE IF EXISTS audit_logs;
