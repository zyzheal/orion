-- Migration: Extend CI type tables with frontend CITypeDesigner fields
-- Adds: icon, category, enabled to ci_types
-- Adds: attr_key, display_name, options, validation_rule, sort_order to ci_type_attributes
-- Adds: tenant_id to ci_type_versions
-- Created: 2026-08-12

-- Extend ci_types
ALTER TABLE ci_types ADD COLUMN IF NOT EXISTS icon VARCHAR(255);
ALTER TABLE ci_types ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE ci_types ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE ci_types ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Extend ci_type_attributes
ALTER TABLE ci_type_attributes ADD COLUMN IF NOT EXISTS attr_key VARCHAR(255);
ALTER TABLE ci_type_attributes ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE ci_type_attributes ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb;
ALTER TABLE ci_type_attributes ADD COLUMN IF NOT EXISTS validation_rule VARCHAR(255);
ALTER TABLE ci_type_attributes ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ci_type_attributes ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36);

-- Backfill attr_key from name where attr_key is null
UPDATE ci_type_attributes SET attr_key = name WHERE attr_key IS NULL;
ALTER TABLE ci_type_attributes ALTER COLUMN attr_key SET NOT NULL;

-- Backfill tenant_id from parent ci_types
UPDATE ci_type_attributes a SET tenant_id = t.tenant_id
FROM ci_types t WHERE a.ci_type_id = t.id AND a.tenant_id IS NULL;

-- Extend ci_type_versions
ALTER TABLE ci_type_versions ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36);
UPDATE ci_type_versions v SET tenant_id = t.tenant_id
FROM ci_types t WHERE v.ci_type_id = t.id AND v.tenant_id IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ci_types_category ON ci_types(category);
CREATE INDEX IF NOT EXISTS idx_ci_types_enabled ON ci_types(enabled);
CREATE INDEX IF NOT EXISTS idx_ci_type_attributes_tenant ON ci_type_attributes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ci_type_attributes_sort ON ci_type_attributes(ci_type_id, sort_order);