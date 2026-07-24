-- ============================================================================
-- Smart Deploy: PostgreSQL persistence
-- ============================================================================
--
-- Tables:
--   smart_deploy_deployments  - deployment records (one per deployment)
--   smart_deploy_rollbacks    - rollback records
--   smart_deploy_audit        - audit trail entries

CREATE TABLE IF NOT EXISTS smart_deploy_deployments (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  deployment_id     TEXT NOT NULL,
  app_name          TEXT NOT NULL,
  version           TEXT NOT NULL,
  environment       TEXT NOT NULL,
  strategy          TEXT NOT NULL DEFAULT 'rolling',
  status            TEXT NOT NULL DEFAULT 'pending',
  image             TEXT,
  initiated_by      TEXT NOT NULL,
  notes             TEXT,
  change_request_id TEXT,
  commit_sha        TEXT,
  stages            JSONB NOT NULL DEFAULT '[]',
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_smart_deploy_tenant ON smart_deploy_deployments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_smart_deploy_app_env ON smart_deploy_deployments (tenant_id, app_name, environment);
CREATE INDEX IF NOT EXISTS idx_smart_deploy_status ON smart_deploy_deployments (tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_smart_deploy_deployment_id ON smart_deploy_deployments (tenant_id, deployment_id);

ALTER TABLE smart_deploy_deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY smart_deploy_deployments_tenant ON smart_deploy_deployments
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

CREATE TABLE IF NOT EXISTS smart_deploy_rollbacks (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  deployment_id   TEXT NOT NULL,
  target_version  TEXT,
  reason          TEXT NOT NULL,
  triggered_by    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_rollback_tenant ON smart_deploy_rollbacks (tenant_id);
CREATE INDEX IF NOT EXISTS idx_smart_rollback_deployment ON smart_deploy_rollbacks (tenant_id, deployment_id);

ALTER TABLE smart_deploy_rollbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY smart_deploy_rollbacks_tenant ON smart_deploy_rollbacks
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

CREATE TABLE IF NOT EXISTS smart_deploy_audit (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  deployment_id  TEXT NOT NULL,
  action         TEXT NOT NULL,
  performed_by   TEXT NOT NULL,
  details        JSONB NOT NULL DEFAULT '{}',
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_audit_tenant ON smart_deploy_audit (tenant_id);
CREATE INDEX IF NOT EXISTS idx_smart_audit_deployment ON smart_deploy_audit (tenant_id, deployment_id);

ALTER TABLE smart_deploy_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY smart_deploy_audit_tenant ON smart_deploy_audit
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

-- Rollback:
-- DROP TABLE IF EXISTS smart_deploy_audit CASCADE;
-- DROP TABLE IF EXISTS smart_deploy_rollbacks CASCADE;
-- DROP TABLE IF EXISTS smart_deploy_deployments CASCADE;
