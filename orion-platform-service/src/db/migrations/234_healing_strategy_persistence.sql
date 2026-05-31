-- Migration 234: Healing Strategy Persistence
-- Stores healing strategies in PostgreSQL instead of in-memory Map()

CREATE TABLE IF NOT EXISTS healing_strategies (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(64) NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]',
  conditions JSONB NOT NULL DEFAULT '[]',
  confidence INTEGER NOT NULL DEFAULT 50,
  enabled BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  environments JSONB,
  max_retries INTEGER,
  retry_cooldown_ms INTEGER,
  tenant_id VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_healing_strategies_trigger_type ON healing_strategies(trigger_type);
CREATE INDEX IF NOT EXISTS idx_healing_strategies_enabled ON healing_strategies(enabled);
CREATE INDEX IF NOT EXISTS idx_healing_strategies_tenant_id ON healing_strategies(tenant_id);
