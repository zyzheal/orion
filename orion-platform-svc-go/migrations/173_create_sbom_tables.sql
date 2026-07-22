-- Sbom module tables (auto-generated)

CREATE TABLE IF NOT EXISTS s_b_o_m_documents (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(255) NOT NULL,
    format VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    artifact_id VARCHAR(255) NOT NULL,
    artifact_type VARCHAR(255) NOT NULL,
    components_count BIGINT NOT NULL,
    vulnerabilities_count BIGINT NOT NULL,
    licenses_count BIGINT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_s_b_o_m_documents_tenant ON s_b_o_m_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_s_b_o_m_documents_created ON s_b_o_m_documents(created_at DESC);

