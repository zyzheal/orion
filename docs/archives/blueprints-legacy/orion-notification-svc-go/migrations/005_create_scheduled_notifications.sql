CREATE TABLE IF NOT EXISTS scheduled_notifications (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	tenant_id VARCHAR(64) NOT NULL,
	user_id VARCHAR(64),
	template_id VARCHAR(64),
	type VARCHAR(100) NOT NULL DEFAULT 'system',
	title VARCHAR(500) NOT NULL DEFAULT '',
	message TEXT NOT NULL DEFAULT '',
	channel VARCHAR(32) NOT NULL DEFAULT 'in-app',
	scheduled_at TIMESTAMPTZ NOT NULL,
	status VARCHAR(20) NOT NULL DEFAULT 'pending',
	sent_at TIMESTAMPTZ DEFAULT NULL,
	error_message TEXT DEFAULT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_tenant ON scheduled_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_user ON scheduled_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_notifications(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_time ON scheduled_notifications(scheduled_at);
