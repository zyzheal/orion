-- Cmdb module tables

CREATE TABLE IF NOT EXISTS cis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ci_id VARCHAR(255) NOT NULL,
    tenant_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    ci_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    description TEXT,
    created_by VARCHAR(255),
    environment VARCHAR(50),
    tags JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cis_tenant_id ON cis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cis_ci_id ON cis(ci_id);
CREATE INDEX IF NOT EXISTS idx_cis_ci_type ON cis(ci_type);
CREATE INDEX IF NOT EXISTS idx_cis_status ON cis(status);

CREATE TABLE IF NOT EXISTS ci_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_ci_id VARCHAR(255) NOT NULL,
    to_ci_id VARCHAR(255) NOT NULL,
    relation_type VARCHAR(100) NOT NULL,
    description TEXT,
    tenant_id BIGINT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ci_relations_tenant_id ON ci_relations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ci_relations_from_ci_id ON ci_relations(from_ci_id);
CREATE INDEX IF NOT EXISTS idx_ci_relations_to_ci_id ON ci_relations(to_ci_id);

CREATE TABLE IF NOT EXISTS ci_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ci_id VARCHAR(255) NOT NULL,
    version BIGINT NOT NULL,
    snapshot JSONB,
    tenant_id BIGINT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ci_versions_tenant_id ON ci_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ci_versions_ci_id ON ci_versions(ci_id);
