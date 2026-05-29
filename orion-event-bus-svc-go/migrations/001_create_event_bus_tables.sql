CREATE TABLE IF NOT EXISTS event_topics (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	event_type VARCHAR(128) NOT NULL, source VARCHAR(128) NOT NULL, payload JSONB NOT NULL DEFAULT '{}', status VARCHAR(32) NOT NULL DEFAULT 'pending', retry_count INT NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_event_topics_tenant ON event_topics(tenant_id, created_at);
