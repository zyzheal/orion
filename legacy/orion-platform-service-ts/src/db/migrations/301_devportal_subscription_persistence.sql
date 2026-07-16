-- Migration 301: Create tables for Developer Portal API Subscriptions
-- Tables: devportal_api_subscriptions, devportal_usage_records

CREATE TABLE IF NOT EXISTS devportal_api_subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  user_id VARCHAR(64) NOT NULL,
  api_name VARCHAR(255) NOT NULL,
  plan_name VARCHAR(64) DEFAULT 'standard',
  quota_per_day INTEGER DEFAULT 1000,
  quota_per_month INTEGER DEFAULT 30000,
  used_today INTEGER DEFAULT 0,
  used_this_month INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  reason TEXT DEFAULT '',
  approved_by VARCHAR(64),
  approved_at TIMESTAMP,
  reject_reason TEXT,
  api_key VARCHAR(128),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON devportal_api_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON devportal_api_subscriptions(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON devportal_api_subscriptions(status);

CREATE TABLE IF NOT EXISTS devportal_usage_records (
  id VARCHAR(64) PRIMARY KEY,
  subscription_id VARCHAR(64) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  endpoint VARCHAR(512) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_records_subscription ON devportal_usage_records(subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_timestamp ON devportal_usage_records(timestamp DESC);
