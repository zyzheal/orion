-- Migration: Create CI Type tables (ci-type module)
-- Created: 2026-07-12

CREATE TABLE IF NOT EXISTS ci_types (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ci_types_tenant ON ci_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ci_types_status ON ci_types(status);

CREATE TABLE IF NOT EXISTS ci_type_attributes (
    id UUID PRIMARY KEY,
    ci_type_id UUID NOT NULL REFERENCES ci_types(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'string',
    required BOOLEAN NOT NULL DEFAULT FALSE,
    default_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ci_type_attributes_ci_type_id ON ci_type_attributes(ci_type_id);

CREATE TABLE IF NOT EXISTS ci_type_versions (
    id UUID PRIMARY KEY,
    ci_type_id UUID NOT NULL REFERENCES ci_types(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    change_summary TEXT,
    attributes_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ci_type_versions_ci_type_id ON ci_type_versions(ci_type_id);
