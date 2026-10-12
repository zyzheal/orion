-- Migration 709: Add attributes JSONB column to cmdb_ci_types
-- ADR-013 Layer 1: 类型定义 — 属性 schema

ALTER TABLE cmdb_ci_types
    ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS icon TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'default';

-- Index for category-based filtering
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_types_category
    ON cmdb_ci_types(tenant_id, category);
