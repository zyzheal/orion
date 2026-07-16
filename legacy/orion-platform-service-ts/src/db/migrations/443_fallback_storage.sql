-- FallbackStorage: unified fallback storage persistence table
-- Task 2.38: Config validation schema — FallbackStorageService PostgreSQL layer
--
-- Each FallbackStorageService instance writes to this table when persistToDb=true.
-- Unique constraint: one record per (tenant_id, prefix, key).
-- Expired records are cleaned up by FallbackStorageRepository.cleanupExpired().

CREATE TABLE IF NOT EXISTS fallback_storage (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id   TEXT NOT NULL,
  prefix      TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       JSONB NOT NULL DEFAULT '{}'::JSONB,
  ttl_ms      INTEGER NOT NULL DEFAULT 300000,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: tenant isolation
ALTER TABLE fallback_storage ENABLE ROW LEVEL SECURITY;

CREATE POLICY fallback_storage_tenant_isolation ON fallback_storage
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

-- Unique constraint: (tenant_id, prefix, key)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fallback_storage_tenant_prefix_key
  ON fallback_storage (tenant_id, prefix, key);

-- Performance: prefix + expires_at queries
CREATE INDEX IF NOT EXISTS idx_fallback_storage_prefix_expires
  ON fallback_storage (tenant_id, prefix, expires_at);

-- Performance: cleanup expired records
CREATE INDEX IF NOT EXISTS idx_fallback_storage_expires
  ON fallback_storage (expires_at) WHERE expires_at < NOW();

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION fn_fallback_storage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fallback_storage_updated_at ON fallback_storage;
CREATE TRIGGER trg_fallback_storage_updated_at
  BEFORE UPDATE ON fallback_storage
  FOR EACH ROW EXECUTE FUNCTION fn_fallback_storage_updated_at();

-- Rollback:
-- DROP TABLE IF EXISTS fallback_storage CASCADE;
