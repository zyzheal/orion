CREATE TABLE IF NOT EXISTS deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    environment VARCHAR(50),
    service_name VARCHAR(255),
    version VARCHAR(100),
    image_tag VARCHAR(255),
    status VARCHAR(50),
    deployed_by VARCHAR(255),
    rollback_to VARCHAR(100),
    deployed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deployments_tenant_id ON deployments (tenant_id);
