-- Migration: create CMDB relationship tables
-- Module: orion-platform-svc-go/internal/cmdb-relationship
-- Description: Tables for CMDB relationship type lifecycle management and
--              concrete CI-to-CI relationship records.
-- Tables:
--   cmdb_relationship_types  - lifecycle-managed relationship type definitions
--   cmdb_relationships       - concrete CI-to-CI relationship records

-- cmdb_relationship_types: relationship type definition registry
CREATE TABLE IF NOT EXISTS cmdb_relationship_types (
    id              VARCHAR(64)  PRIMARY KEY,
    tenant_id       VARCHAR(64)  NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT         DEFAULT '',
    source_type     VARCHAR(128) NOT NULL,  -- allowed source CI type
    target_type     VARCHAR(128) NOT NULL,  -- allowed target CI type
    cardinality     VARCHAR(8)   NOT NULL CHECK (cardinality IN ('1:1','1:N','N:1','N:N')),
    bidirectional   BOOLEAN      NOT NULL DEFAULT FALSE,
    inverse_name    VARCHAR(255) DEFAULT '',  -- label for reverse direction
    icon            VARCHAR(64)  DEFAULT '',
    color           VARCHAR(16)  DEFAULT '',
    attributes      TEXT         DEFAULT '{}',  -- JSON: custom attributes
    enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
    status          VARCHAR(16)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- cmdb_relationships: concrete CI-to-CI relationship records
CREATE TABLE IF NOT EXISTS cmdb_relationships (
    id          VARCHAR(64) PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    source_id   VARCHAR(64) NOT NULL,
    target_id   VARCHAR(64) NOT NULL,
    type_id     VARCHAR(64) NOT NULL REFERENCES cmdb_relationship_types(id),
    attributes  TEXT        DEFAULT '{}',  -- JSON
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- indexes: relationship types
CREATE INDEX IF NOT EXISTS idx_cmdb_rt_tenant       ON cmdb_relationship_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_rt_name         ON cmdb_relationship_types(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_cmdb_rt_status       ON cmdb_relationship_types(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_cmdb_rt_source_type  ON cmdb_relationship_types(source_type);
CREATE INDEX IF NOT EXISTS idx_cmdb_rt_target_type  ON cmdb_relationship_types(target_type);

-- indexes: relationships
CREATE INDEX IF NOT EXISTS idx_cmdb_rel_tenant      ON cmdb_relationships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_rel_source      ON cmdb_relationships(tenant_id, source_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_rel_target      ON cmdb_relationships(tenant_id, target_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_rel_type        ON cmdb_relationships(type_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_rel_source_type ON cmdb_relationships(tenant_id, source_id, type_id);
