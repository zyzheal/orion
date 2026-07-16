-- Migration 120: Create unified_resources and deployment_results tables
-- Tables for ResourceAbstractionLayer - unified resource view and multi-provider deployments

-- Unified Resources (cross-provider resource abstraction)
CREATE TABLE IF NOT EXISTS unified_resources (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    resource_type VARCHAR(50) NOT NULL DEFAULT 'other',
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL DEFAULT 'unknown',
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    spec JSONB DEFAULT '{}',
    tags JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_unified_resources_tenant ON unified_resources(tenant_id);
CREATE INDEX idx_unified_resources_type ON unified_resources(resource_type);
CREATE INDEX idx_unified_resources_provider ON unified_resources(provider);
CREATE INDEX idx_unified_resources_status ON unified_resources(status);

COMMENT ON TABLE unified_resources IS 'Unified resource view across all cloud providers';

-- Deployment Results (multi-provider deployment tracking)
CREATE TABLE IF NOT EXISTS deployment_results (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    provider VARCHAR(100) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'deploying',
    resources TEXT[] DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deployment_results_tenant ON deployment_results(tenant_id);
CREATE INDEX idx_deployment_results_status ON deployment_results(status);
CREATE INDEX idx_deployment_results_provider ON deployment_results(provider);

COMMENT ON TABLE deployment_results IS 'Tracks multi-provider deployment results and status';
