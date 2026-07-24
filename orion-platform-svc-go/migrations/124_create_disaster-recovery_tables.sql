-- Disaster-Recovery module tables (auto-generated)

CREATE TABLE IF NOT EXISTS disaster_plans (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    steps VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    last_run TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_disaster_plans_tenant ON disaster_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_disaster_plans_created ON disaster_plans(created_at DESC);

