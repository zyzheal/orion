-- Migration 0297: Auto Recovery degraded state persistence
-- Tracks degraded provider state and success rates beyond the existing auto_recovery_records

CREATE TABLE IF NOT EXISTS auto_recovery_degraded_state (
  id VARCHAR(100) PRIMARY KEY,
  provider_id VARCHAR(200) NOT NULL UNIQUE,
  degraded_at TIMESTAMP NOT NULL,
  last_success_rate NUMERIC(5,4),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_degraded_state_provider ON auto_recovery_degraded_state(provider_id);
CREATE INDEX IF NOT EXISTS idx_degraded_state_degraded_at ON auto_recovery_degraded_state(degraded_at);
