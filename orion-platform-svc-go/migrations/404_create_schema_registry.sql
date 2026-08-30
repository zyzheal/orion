-- Migration 404: schema-registry tables
-- Provides durable storage for the schema-registry module. The interface
-- (repository.Interface) is identical to the InMemory implementation used
-- in Phase 1a, so callers need no changes beyond wiring.

-- ============================================================
-- schema_registry: one row per (tenant_id, namespace, name)
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_registry (
    id             VARCHAR(128) PRIMARY KEY,        -- <namespace>/<name>
    tenant_id      VARCHAR(64)  NOT NULL DEFAULT 'default',
    namespace      VARCHAR(128) NOT NULL,
    name           VARCHAR(128) NOT NULL,
    type           VARCHAR(32)  NOT NULL,           -- protobuf/avro/json/postgresql/mongodb/kafka-avro/event-bridge
    version        INTEGER      NOT NULL DEFAULT 1,
    status         VARCHAR(16)  NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','active','deprecated','archived')),
    owner          VARCHAR(128) NOT NULL,
    description    TEXT         NULL,
    fields         JSONB        NOT NULL DEFAULT '[]'::jsonb,
    relationships  JSONB        NULL,
    indexes        JSONB        NULL,
    compatibility  VARCHAR(16)  NOT NULL DEFAULT 'backward'
                     CHECK (compatibility IN ('none','backward','forward','full')),
    metadata       JSONB        NULL,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schema_registry_tenant_ns
    ON schema_registry (tenant_id, namespace);
CREATE INDEX IF NOT EXISTS idx_schema_registry_tenant_status
    ON schema_registry (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_schema_registry_tenant_owner
    ON schema_registry (tenant_id, owner);

-- ============================================================
-- schema_registry_versions: version history per schema
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_registry_versions (
    id             VARCHAR(36)  PRIMARY KEY,        -- uuid
    tenant_id      VARCHAR(64)  NOT NULL DEFAULT 'default',
    namespace      VARCHAR(128) NOT NULL,
    name           VARCHAR(128) NOT NULL,
    version        INTEGER      NOT NULL,
    schema_json    JSONB        NULL,               -- full snapshot of the Schema at this version (may be null on initial create)
    changes        JSONB        NULL,               -- []EvolutionChange
    released_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_by    VARCHAR(128) NOT NULL,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_schema_registry_versions
    ON schema_registry_versions (tenant_id, namespace, name, version);
CREATE INDEX IF NOT EXISTS idx_schema_registry_versions_tenant_ns
    ON schema_registry_versions (tenant_id, namespace, name);
