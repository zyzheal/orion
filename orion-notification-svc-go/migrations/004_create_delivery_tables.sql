CREATE TABLE IF NOT EXISTS notification_deliveries (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	notification_id UUID NOT NULL,
	channel VARCHAR(32) NOT NULL,
	recipient VARCHAR(256) NOT NULL,
	subject VARCHAR(512) DEFAULT '',
	body TEXT DEFAULT '',
	status VARCHAR(32) NOT NULL DEFAULT 'pending',
	attempt_number INT NOT NULL DEFAULT 1,
	max_attempts INT NOT NULL DEFAULT 3,
	error_message TEXT DEFAULT NULL,
	response_body TEXT DEFAULT NULL,
	response_status INT DEFAULT NULL,
	sent_at TIMESTAMPTZ DEFAULT NULL,
	next_retry_at TIMESTAMPTZ DEFAULT NULL,
	fallback_channel VARCHAR(32) DEFAULT NULL,
	metadata JSONB NOT NULL DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_deliveries_tenant_notification ON notification_deliveries(tenant_id, notification_id);
CREATE INDEX idx_deliveries_tenant_status ON notification_deliveries(tenant_id, status, next_retry_at);
CREATE INDEX idx_deliveries_tenant_channel ON notification_deliveries(tenant_id, channel);
