-- Migration #247: Create data_catalog_entries table
-- Stores metadata about data assets (tables, columns, fields) for the Data Catalog module.

CREATE TABLE IF NOT EXISTS data_catalog_entries (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(512) NOT NULL,
    description TEXT DEFAULT '',
    data_type VARCHAR(128) NOT NULL,
    table_name VARCHAR(512) NOT NULL,
    column_name VARCHAR(512) DEFAULT '',
    data_format VARCHAR(128) DEFAULT '',
    sample_values TEXT DEFAULT '',
    schema_version VARCHAR(128) DEFAULT '',
    owner VARCHAR(255) DEFAULT '',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Foreign key to tenants table (tenant_id)
ALTER TABLE data_catalog_entries ADD CONSTRAINT fk_data_catalog_entries_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_data_catalog_entries_tenant ON data_catalog_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_catalog_entries_table ON data_catalog_entries(tenant_id, table_name);
CREATE INDEX IF NOT EXISTS idx_data_catalog_entries_type ON data_catalog_entries(tenant_id, data_type);
CREATE INDEX IF NOT EXISTS idx_data_catalog_entries_owner ON data_catalog_entries(tenant_id, owner);
CREATE INDEX IF NOT EXISTS idx_data_catalog_entries_created ON data_catalog_entries(created_at DESC);
