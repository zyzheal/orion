-- Migration 054: Create event_bus tables for EventBus persistence
-- Stores event subscriptions, event history, and event bus configuration

-- Event bus configuration table
CREATE TABLE IF NOT EXISTS event_bus_config (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Event subscription table (persistent subscription registry)
CREATE TABLE IF NOT EXISTS event_subscriptions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(36) NOT NULL DEFAULT 'default',
    subject_pattern VARCHAR(255) NOT NULL,
    handler_name VARCHAR(100) NOT NULL,
    handler_type VARCHAR(50) DEFAULT 'nats',
    durable_name VARCHAR(100),
    queue_group VARCHAR(100),
    filter_subject VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_subscription_status CHECK (status IN ('active', 'paused', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_event_subscriptions_tenant ON event_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_subject ON event_subscriptions(subject_pattern);
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_status ON event_subscriptions(status);

-- Event history table (published event log for audit & replay)
CREATE TABLE IF NOT EXISTS event_bus_events (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(36) NOT NULL DEFAULT 'default',
    event_type VARCHAR(200) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    source VARCHAR(200) DEFAULT 'orion-platform-service',
    payload JSONB NOT NULL,
    sequence_num BIGINT,
    status VARCHAR(20) DEFAULT 'published',
    published_by VARCHAR(100),
    published_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP,
    CONSTRAINT chk_event_status CHECK (status IN ('published', 'pending_fallback', 'pending_published', 'delivered', 'failed', 'dead_letter'))
);

CREATE INDEX IF NOT EXISTS idx_event_bus_events_tenant ON event_bus_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_bus_events_type ON event_bus_events(event_type);
CREATE INDEX IF NOT EXISTS idx_event_bus_events_subject ON event_bus_events(subject);
CREATE INDEX IF NOT EXISTS idx_event_bus_events_status ON event_bus_events(status);
CREATE INDEX IF NOT EXISTS idx_event_bus_events_published ON event_bus_events(published_at DESC);
CREATE SEQUENCE IF NOT EXISTS event_bus_seq START 1;
