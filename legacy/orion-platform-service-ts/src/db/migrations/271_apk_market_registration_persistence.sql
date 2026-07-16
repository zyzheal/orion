-- Migration 271: APK Market Registration Persistence
-- Stores metadata about registered APK market uploaders
-- The actual MarketUploader objects (with upload methods) remain in-memory,
-- but their registration metadata is persisted for audit and recovery.

CREATE TABLE IF NOT EXISTS apk_market_registrations (
  id           VARCHAR(100) PRIMARY KEY,
  market_name  VARCHAR(100) NOT NULL UNIQUE,
  status       VARCHAR(20) NOT NULL DEFAULT 'active',
  config       JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apk_market_registrations_name ON apk_market_registrations(market_name);
CREATE INDEX IF NOT EXISTS idx_apk_market_registrations_status ON apk_market_registrations(status);

COMMENT ON TABLE apk_market_registrations IS 'APK market uploader registration metadata (Huawei, Xiaomi, OPPO, etc.)';
COMMENT ON COLUMN apk_market_registrations.market_name IS 'Market name (lowercase): huawei, xiaomi, oppo, vivo, honor, tencent, pgyer, fir, googleplay, samsung';
COMMENT ON COLUMN apk_market_registrations.status IS 'Registration status: active, inactive';

-- Rollback:
-- DROP TABLE IF EXISTS apk_market_registrations;
