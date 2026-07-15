-- Multi-Modal-Trigger module tables (auto-generated)

CREATE TABLE IF NOT EXISTS multi_modal_triggers (
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

CREATE INDEX IF NOT EXISTS idx_multi_modal_triggers_tenant ON multi_modal_triggers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_multi_modal_triggers_created ON multi_modal_triggers(created_at DESC);

