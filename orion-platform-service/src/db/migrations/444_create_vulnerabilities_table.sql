-- ============================================================
-- Migration 444: Vulnerabilities Table
-- ============================================================
-- Purpose:
--   Track known vulnerabilities (CVEs) detected in project dependencies.
--   Supports real-time npm audit integration, remediation tracking,
--   and tenant-isolated reporting.
-- ============================================================

-- -------------------- vulnerabilities --------------------
CREATE TABLE IF NOT EXISTS vulnerabilities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cve_id          VARCHAR(100) NOT NULL,
  package_name    VARCHAR(255) NOT NULL,
  package_version VARCHAR(100),
  severity        VARCHAR(20) NOT NULL DEFAULT 'medium',
  description     TEXT,
  fix_version     VARCHAR(100),
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vulnerabilities_tenant
  ON vulnerabilities (tenant_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_cve
  ON vulnerabilities (cve_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_package
  ON vulnerabilities (package_name);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_severity
  ON vulnerabilities (severity);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_status
  ON vulnerabilities (status);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_detected_at
  ON vulnerabilities (detected_at DESC);

-- Unique constraint: one open vulnerability per tenant + CVE + package combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_vulnerabilities_tenant_cve_package_open
  ON vulnerabilities (tenant_id, cve_id, package_name)
  WHERE status = 'open';

ALTER TABLE vulnerabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE vulnerabilities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_vulnerabilities ON vulnerabilities;
CREATE POLICY tenant_isolation_vulnerabilities ON vulnerabilities
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

-- Rollback:
-- DROP TABLE IF EXISTS vulnerabilities;
