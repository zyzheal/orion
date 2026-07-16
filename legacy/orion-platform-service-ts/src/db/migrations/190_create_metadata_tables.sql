-- Migration: 190_create_metadata_tables.sql
-- Purpose: Create tables for metadata management (Phase 4 Batch 2)

-- Metadata Catalog (data asset registry)
CREATE TABLE IF NOT EXISTS metadata_catalog (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    type        VARCHAR(50) NOT NULL,  -- table, view, pipeline, dashboard, api
    owner       VARCHAR(255),
    tags        TEXT[],
    properties  JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_catalog_type CHECK (type IN ('table', 'view', 'pipeline', 'dashboard', 'api', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_metadata_catalog_tenant ON metadata_catalog(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metadata_catalog_type ON metadata_catalog(type);

-- Metadata Lineage (data flow tracking)
CREATE TABLE IF NOT EXISTS metadata_lineage (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    source_id   UUID NOT NULL REFERENCES metadata_catalog(id),
    target_id   UUID NOT NULL REFERENCES metadata_catalog(id),
    relation    VARCHAR(50) NOT NULL,  -- transforms, reads, writes, depends_on
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_lineage_relation CHECK (relation IN ('transforms', 'reads', 'writes', 'depends_on'))
);

CREATE INDEX IF NOT EXISTS idx_metadata_lineage_tenant ON metadata_lineage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metadata_lineage_source ON metadata_lineage(source_id);
CREATE INDEX IF NOT EXISTS idx_metadata_lineage_target ON metadata_lineage(target_id);
