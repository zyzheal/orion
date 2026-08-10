-- Create statistics tables for statistics module
CREATE TABLE IF NOT EXISTS statistics (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    name VARCHAR(256) NOT NULL,
    value DOUBLE PRECISION DEFAULT 0,
    window VARCHAR(32),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_statistics_tenant ON statistics(tenant_id);
CREATE INDEX idx_statistics_name_window ON statistics(tenant_id, name, window);
