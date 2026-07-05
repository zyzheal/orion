CREATE TABLE IF NOT EXISTS chat_channels (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	channel VARCHAR(128) NOT NULL, command VARCHAR(256) NOT NULL, response TEXT, platform VARCHAR(32) NOT NULL DEFAULT 'slack', metadata JSONB DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chat_channels_tenant ON chat_channels(tenant_id, created_at);
