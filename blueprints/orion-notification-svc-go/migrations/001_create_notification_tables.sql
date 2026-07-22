CREATE TABLE IF NOT EXISTS notifications (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	channel VARCHAR(32) NOT NULL,
	recipient VARCHAR(256) NOT NULL,
	subject VARCHAR(512) NOT NULL DEFAULT '',
	body TEXT NOT NULL DEFAULT '',
	status VARCHAR(32) NOT NULL DEFAULT 'pending',
	metadata JSONB NOT NULL DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id, created_at);

CREATE TABLE IF NOT EXISTS notification_templates (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	channel VARCHAR(32) NOT NULL,
	subject VARCHAR(512) NOT NULL DEFAULT '',
	body TEXT NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_templates_tenant ON notification_templates(tenant_id);

CREATE TABLE IF NOT EXISTS notification_channels (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	type VARCHAR(32) NOT NULL,
	config JSONB NOT NULL DEFAULT '{}',
	enabled BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_channels_tenant ON notification_channels(tenant_id);
