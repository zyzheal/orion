-- Create row_editor table for roweditor module
CREATE TABLE IF NOT EXISTS row_editor (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    key VARCHAR(256) NOT NULL,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_row_editor_tenant_key ON row_editor(tenant_id, key);
