-- Message-Queue module tables (auto-generated)

CREATE TABLE IF NOT EXISTS message_queues (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_message_queues_tenant ON message_queues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_queues_created ON message_queues(created_at DESC);

