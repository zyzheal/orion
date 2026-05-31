-- Migration 302: Create table for Developer Portal Mock Rules
-- Table: devportal_mock_rules

CREATE TABLE IF NOT EXISTS devportal_mock_rules (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  method VARCHAR(10) NOT NULL,
  path VARCHAR(512) NOT NULL,
  status_code INTEGER DEFAULT 200,
  headers JSONB DEFAULT '{"Content-Type": "application/json"}',
  body JSONB DEFAULT '{}',
  delay INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  match_type VARCHAR(20) DEFAULT 'exact',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mock_rules_tenant ON devportal_mock_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mock_rules_enabled ON devportal_mock_rules(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_mock_rules_method ON devportal_mock_rules(tenant_id, method);
