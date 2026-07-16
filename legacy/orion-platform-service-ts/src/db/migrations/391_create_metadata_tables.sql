-- Migration: 391_create_metadata_tables.sql
-- Purpose: Persist metadata catalog items and lineage relations

CREATE TABLE IF NOT EXISTS metadata_catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'other',
  owner VARCHAR(200),
  tags TEXT[] DEFAULT '{}',
  properties JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metadata_lineage_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  source_id UUID NOT NULL,
  target_id UUID NOT NULL,
  relation VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_metadata_catalog_tenant ON metadata_catalog_items(tenant_id);
CREATE INDEX idx_metadata_catalog_type ON metadata_catalog_items(type);
CREATE INDEX idx_metadata_lineage_tenant ON metadata_lineage_relations(tenant_id);
CREATE INDEX idx_metadata_lineage_source ON metadata_lineage_relations(source_id);
CREATE INDEX idx_metadata_lineage_target ON metadata_lineage_relations(target_id);
