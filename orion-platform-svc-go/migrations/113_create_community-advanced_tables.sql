-- Community-Advanced module tables (auto-generated)

CREATE TABLE IF NOT EXISTS community_advanceds (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_community_advanceds_tenant ON community_advanceds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_community_advanceds_created ON community_advanceds(created_at DESC);

