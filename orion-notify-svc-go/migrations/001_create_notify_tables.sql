CREATE TABLE IF NOT EXISTS notify_templates (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	channel VARCHAR(32) NOT NULL, recipient VARCHAR(256) NOT NULL, subject VARCHAR(512), body TEXT NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'pending',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notify_templates_tenant ON notify_templates(tenant_id, created_at);
