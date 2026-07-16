-- Config Approval Persistence Migration
-- Sub-project F: Data Persistence - Task 2
-- Date: 2026-04-30

CREATE TABLE IF NOT EXISTS config_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id VARCHAR(255) NOT NULL,
  config_key VARCHAR(255) NOT NULL,
  environment VARCHAR(50) NOT NULL,
  change_type VARCHAR(50) NOT NULL DEFAULT 'modify',
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  requester VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  approvals JSONB DEFAULT '[]',
  required_approvals INTEGER DEFAULT 1,
  applied_at TIMESTAMP WITH TIME ZONE,
  applied_by VARCHAR(255),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_change_requests_config ON config_change_requests(config_id);
CREATE INDEX IF NOT EXISTS idx_config_change_requests_status ON config_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_config_change_requests_environment ON config_change_requests(environment);
CREATE INDEX IF NOT EXISTS idx_config_change_requests_requester ON config_change_requests(requester);
