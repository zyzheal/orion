-- Migration 037: Alert Suppression

CREATE TABLE IF NOT EXISTS alert_suppression_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  condition       JSONB NOT NULL,
  schedule        JSONB,
  reason          TEXT,
  created_by      UUID,
  expires_at      TIMESTAMPTZ,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alert_suppression_tenant ON alert_suppression_rules(tenant_id);
CREATE INDEX idx_alert_suppression_enabled ON alert_suppression_rules(enabled);

CREATE TABLE IF NOT EXISTS maintenance_windows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  affected_services TEXT[] NOT NULL DEFAULT '{}',
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_maintenance_windows_tenant ON maintenance_windows(tenant_id);
CREATE INDEX idx_maintenance_windows_time ON maintenance_windows(start_time, end_time);

CREATE TABLE IF NOT EXISTS known_issues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  fingerprint     VARCHAR(255) NOT NULL,
  ticket_id       UUID REFERENCES tickets(id),
  resolved        BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_known_issues_tenant ON known_issues(tenant_id);
CREATE INDEX idx_known_issues_fingerprint ON known_issues(fingerprint);

-- Rollback:
-- DROP TABLE IF EXISTS known_issues, maintenance_windows, alert_suppression_rules;
