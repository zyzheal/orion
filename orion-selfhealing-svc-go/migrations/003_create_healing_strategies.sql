-- Migration 003: Create healing_strategies table
-- Built-in and custom healing strategies with actions and conditions.

CREATE TABLE IF NOT EXISTS healing_strategies (
    id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    trigger_type VARCHAR(64) NOT NULL,
    actions JSONB NOT NULL DEFAULT '[]',
    conditions JSONB NOT NULL DEFAULT '[]',
    confidence INT NOT NULL DEFAULT 50,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    environments JSONB,
    max_retries INT,
    retry_cooldown_ms BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_strategies_enabled ON healing_strategies(enabled);
CREATE INDEX idx_strategies_trigger ON healing_strategies(trigger_type);
CREATE INDEX idx_strategies_confidence ON healing_strategies(confidence DESC);
