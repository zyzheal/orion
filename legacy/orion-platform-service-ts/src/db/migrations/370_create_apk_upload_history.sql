-- Migration 370: Create apk_upload_history table for PostgreSQL persistence
-- Tracks APK uploads to app markets with read-through cache (in-memory) fallback

CREATE TABLE IF NOT EXISTS apk_upload_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_name VARCHAR(200) NOT NULL,
  version_code INTEGER NOT NULL,
  version_name VARCHAR(50),
  file_size BIGINT,
  upload_by VARCHAR(100),
  upload_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status VARCHAR(20) NOT NULL DEFAULT 'uploaded',
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_apk_upload_tenant ON apk_upload_history(tenant_id);
CREATE INDEX idx_apk_upload_app ON apk_upload_history(app_name);
CREATE INDEX idx_apk_upload_at ON apk_upload_history(upload_at DESC);
