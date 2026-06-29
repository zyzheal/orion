-- Migration 363: Dependency Poisoning Scans Persistence
-- Creates table for tracking dependency poisoning scan results (typosquatting, known malicious packages)

CREATE TABLE IF NOT EXISTS dependency_poisoning_scans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  packages_scanned INT NOT NULL DEFAULT 0,
  malicious_found INT NOT NULL DEFAULT 0,
  typosquatting_found INT NOT NULL DEFAULT 0,
  risk_score      INT NOT NULL DEFAULT 0,
  risk_level      VARCHAR(20) NOT NULL DEFAULT 'safe',  -- safe | low | medium | high | critical
  scan_data       JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dependency_poisoning_scans_tenant ON dependency_poisoning_scans(tenant_id);
CREATE INDEX idx_dependency_poisoning_scans_risk ON dependency_poisoning_scans(risk_level);

-- Enable RLS
ALTER TABLE dependency_poisoning_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_dependency_poisoning_scans ON dependency_poisoning_scans
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
