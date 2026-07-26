-- Event Subscriptions: handlers subscribed to event types per tenant
CREATE TABLE IF NOT EXISTS event_subscriptions (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	tenant_id VARCHAR(64) NOT NULL,
	event_type VARCHAR(128) NOT NULL,
	handler VARCHAR(256) NOT NULL,
	enabled BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_tenant ON event_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_type ON event_subscriptions(tenant_id, event_type);

-- Event Logs: published event records
CREATE TABLE IF NOT EXISTS event_logs (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	tenant_id VARCHAR(64) NOT NULL,
	event_type VARCHAR(128) NOT NULL,
	payload JSONB NOT NULL DEFAULT '{}',
	processed BOOLEAN NOT NULL DEFAULT false,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_logs_tenant ON event_logs(tenant_id, created_at DESC);
