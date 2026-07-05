-- Migration 434: Deployment Audit Trail
-- Persists audit trail entries for deployment history/audit service

CREATE TABLE IF NOT EXISTS deployment_audit_trail (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id   VARCHAR(200) NOT NULL,
  action          VARCHAR(100) NOT NULL,
  performed_by    VARCHAR(200) NOT NULL DEFAULT 'system',
  details         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deployment_audit_trail_deployment ON deployment_audit_trail(deployment_id);
CREATE INDEX idx_deployment_audit_trail_created ON deployment_audit_trail(created_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS deployment_audit_trail CASCADE;
