-- Iac module tables

CREATE TABLE IF NOT EXISTS iac_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    backend_type VARCHAR(50) NOT NULL,
    backend_config JSONB,
    variables JSONB,
    environment VARCHAR(255),
    terraform_version VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_iac_workspaces_tenant_id ON iac_workspaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_iac_workspaces_status ON iac_workspaces(status);

CREATE TABLE IF NOT EXISTS iac_workspace_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    source VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    inputs JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_iac_workspace_modules_tenant_id ON iac_workspace_modules(tenant_id);

CREATE TABLE IF NOT EXISTS iac_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    workspace_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    added INTEGER DEFAULT 0,
    changed INTEGER DEFAULT 0,
    destroyed INTEGER DEFAULT 0,
    plan_output TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_iac_plans_tenant_id ON iac_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_iac_plans_workspace_id ON iac_plans(workspace_id);
CREATE INDEX IF NOT EXISTS idx_iac_plans_status ON iac_plans(status);

CREATE TABLE IF NOT EXISTS iac_state_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    workspace_id VARCHAR(255) NOT NULL,
    serial INTEGER DEFAULT 0,
    state TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_iac_state_versions_tenant_id ON iac_state_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_iac_state_versions_workspace_id ON iac_state_versions(workspace_id);

CREATE TABLE IF NOT EXISTS iac_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    workspace_id VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(255),
    module_address VARCHAR(255),
    status VARCHAR(50),
    tags JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_iac_resources_tenant_id ON iac_resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_iac_resources_workspace_id ON iac_resources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_iac_resources_type ON iac_resources(type);
