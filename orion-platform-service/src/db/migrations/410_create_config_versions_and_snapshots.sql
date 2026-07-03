-- ============================================================
-- Config Versions & Snapshots
-- Migration: 410
-- ============================================================
-- Purpose:
--   - config_versions: per-key change history (old_value -> new_value)
--   - config_snapshots: full-config point-in-time snapshots
--
-- Both tables use domain (tenant_id) for multi-tenant isolation.
-- ============================================================

-- -------------------- config_versions --------------------

CREATE TABLE IF NOT EXISTS config_versions (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  domain        TEXT NOT NULL DEFAULT 'default',
  key           TEXT NOT NULL,
  old_value     JSONB,
  new_value     JSONB NOT NULL,
  changed_by    TEXT NOT NULL DEFAULT 'system',
  change_type   TEXT NOT NULL DEFAULT 'update',
  version       INTEGER NOT NULL,
  comment       TEXT,
  checksum      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_versions_tenant_key
  ON config_versions (tenant_id, key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_config_versions_tenant_domain
  ON config_versions (tenant_id, domain);

-- -------------------- config_snapshots --------------------

CREATE TABLE IF NOT EXISTS config_snapshots (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  snapshot_name  TEXT NOT NULL,
  created_by     TEXT NOT NULL DEFAULT 'system',
  config_data    JSONB NOT NULL,
  checksum       TEXT NOT NULL,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_snapshots_tenant
  ON config_snapshots (tenant_id, created_at DESC);

-- ============================================================
-- Row Level Security (optional, enable with: ALTER TABLE ... ENABLE ROW LEVEL SECURITY)
-- ============================================================
-- ALTER TABLE config_versions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE config_snapshots ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY config_versions_tenant_isolation ON config_versions
--   USING (tenant_id = current_setting('app.current_tenant', true));
--
-- CREATE POLICY config_snapshots_tenant_isolation ON config_snapshots
--   USING (tenant_id = current_setting('app.current_tenant', true));
