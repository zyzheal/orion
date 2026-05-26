-- Migration 001: Create tenant tables

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tenants (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             VARCHAR(255) NOT NULL UNIQUE,
    display_name     VARCHAR(255),
    status           VARCHAR(30) NOT NULL DEFAULT 'active',
    quota_users      INT NOT NULL DEFAULT 100,
    quota_storage_mb INT NOT NULL DEFAULT 1024,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_name ON tenants(name);

-- Default tenant
INSERT INTO tenants (id, name, display_name, status, quota_users, quota_storage_mb)
VALUES ('00000000-0000-0000-0000-000000000000', 'default', 'Default Tenant', 'active', 1000, 10240)
ON CONFLICT (name) DO NOTHING;
