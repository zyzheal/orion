-- Migration 373: Create alert_deduplication table
-- 用于 AlertDeduplicationService PostgreSQL 持久化，支持 fingerprint/occurrence 跟踪和 suppressed 查询

CREATE TABLE IF NOT EXISTS alert_deduplication (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fingerprint VARCHAR(200) NOT NULL,
  alert_id UUID NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  suppressed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_dedup_tenant ON alert_deduplication(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_dedup_fp ON alert_deduplication(fingerprint);
CREATE INDEX IF NOT EXISTS idx_alert_dedup_suppressed ON alert_deduplication(suppressed) WHERE suppressed = true;
