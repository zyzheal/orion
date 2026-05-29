CREATE TABLE IF NOT EXISTS digital_twins (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	entity_type VARCHAR(64) NOT NULL, state JSONB NOT NULL DEFAULT '{}', sync_interval INT NOT NULL DEFAULT 300, config JSONB DEFAULT '{}', last_synced TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_digital_twins_tenant ON digital_twins(tenant_id, created_at);
