CREATE TABLE IF NOT EXISTS healing_rules (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	trigger_type VARCHAR(64) NOT NULL, action VARCHAR(128) NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'active', config JSONB DEFAULT '{}', last_triggered TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_healing_rules_tenant ON healing_rules(tenant_id, created_at);
