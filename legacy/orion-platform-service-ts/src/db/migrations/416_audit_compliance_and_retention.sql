-- Migration 416: Audit Compliance and Retention
-- Adds audit retention policies and archive tables for SOC2/ISO27001 compliance

-- 审计日志保留策略表
CREATE TABLE IF NOT EXISTS audit_retention_policies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  retention_days      INT NOT NULL DEFAULT 365,
  archive_before_delete BOOLEAN NOT NULL DEFAULT true,
  enabled             BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

CREATE INDEX idx_audit_retention_policies_tenant ON audit_retention_policies(tenant_id);

-- 审计日志归档表（用于长期保留和合规审计）
CREATE TABLE IF NOT EXISTS audit_logs_archive (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  user_id       UUID,
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
  created_at    TIMESTAMPTZ NOT NULL,
  archived_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_archive_tenant ON audit_logs_archive(tenant_id);
CREATE INDEX idx_audit_logs_archive_created ON audit_logs_archive(created_at DESC);
CREATE INDEX idx_audit_logs_archive_action ON audit_logs_archive(action);

-- Rollback:
-- DROP TABLE IF EXISTS audit_logs_archive;
-- DROP TABLE IF EXISTS audit_retention_policies;
