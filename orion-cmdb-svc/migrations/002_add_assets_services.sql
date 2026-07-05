-- Migration: 002_add_assets_services.sql
-- Description: Add CMDB assets and services tables for basic CRUD operations
-- Created: 2026-05-16

-- CMDB Assets table: stores infrastructure assets (servers, containers, storage, etc.)
CREATE TABLE IF NOT EXISTS cmdb_assets (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(100) NOT NULL,
    environment VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    properties JSONB NOT NULL DEFAULT '{}',
    tags JSONB NOT NULL DEFAULT '[]',
    owner_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- CMDB Services table: stores service definitions and dependencies
CREATE TABLE IF NOT EXISTS cmdb_services (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    owner_team VARCHAR(255),
    dependencies JSONB NOT NULL DEFAULT '[]',
    endpoints JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX idx_cmdb_assets_type ON cmdb_assets(asset_type);
CREATE INDEX idx_cmdb_assets_status ON cmdb_assets(status);
CREATE INDEX idx_cmdb_assets_environment ON cmdb_assets(environment);
CREATE INDEX idx_cmdb_assets_owner ON cmdb_assets(owner_id);

CREATE INDEX idx_cmdb_services_name ON cmdb_services(name);
CREATE INDEX idx_cmdb_services_type ON cmdb_services(service_type);
CREATE INDEX idx_cmdb_services_status ON cmdb_services(status);
CREATE INDEX idx_cmdb_services_team ON cmdb_services(owner_team);

-- Comments for documentation
COMMENT ON TABLE cmdb_assets IS 'CMDB infrastructure assets - servers, containers, storage, network devices';
COMMENT ON TABLE cmdb_services IS 'CMDB service definitions with dependencies and endpoints';

-- Enable Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE cmdb_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_services ENABLE ROW LEVEL SECURITY;