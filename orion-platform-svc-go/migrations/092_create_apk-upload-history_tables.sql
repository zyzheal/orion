-- Apk-Upload-History module tables (auto-generated)

CREATE TABLE IF NOT EXISTS apk_upload_records (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    market VARCHAR(255) NOT NULL,
    version VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_apk_upload_records_tenant ON apk_upload_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_apk_upload_records_created ON apk_upload_records(created_at DESC);

