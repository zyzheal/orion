-- Supply-Chain module tables (auto-generated)

CREATE TABLE IF NOT EXISTS artifacts (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_artifacts_tenant ON artifacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_created ON artifacts(created_at DESC);

CREATE TABLE IF NOT EXISTS s_b_o_ms (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    pipeline_id VARCHAR(255),
    artifact_id VARCHAR(255) NOT NULL,
    sbom_format VARCHAR(255) NOT NULL,
    sbom_version VARCHAR(255) NOT NULL,
    components VARCHAR(255) NOT NULL,
    dependencies VARCHAR(255) NOT NULL,
    vulnerabilities VARCHAR(255) NOT NULL,
    metadata VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_s_b_o_ms_tenant ON s_b_o_ms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_s_b_o_ms_created ON s_b_o_ms(created_at DESC);

CREATE TABLE IF NOT EXISTS artifact_signatures (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    artifact_id VARCHAR(255) NOT NULL,
    signature VARCHAR(255) NOT NULL,
    signature_type VARCHAR(255) NOT NULL,
    public_key VARCHAR(255),
    certificate VARCHAR(255),
    signed_by VARCHAR(255) NOT NULL,
    signed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    metadata VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_artifact_signatures_tenant ON artifact_signatures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifact_signatures_created ON artifact_signatures(created_at DESC);

