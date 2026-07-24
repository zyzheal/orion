-- Migration 254: Global Search Service tables
-- Indexing configuration and status tracking for per-module search indexers.

-- Search configuration per module
CREATE TABLE IF NOT EXISTS global_search_configs (
    id              BIGSERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ  NULL,
    module          VARCHAR(64)  NOT NULL,
    index_name      VARCHAR(128) NOT NULL,
    enabled         BOOLEAN      NOT NULL DEFAULT true,
    full_text_field VARCHAR(64)  DEFAULT 'title',
    refresh_interval VARCHAR(32) DEFAULT '5s',
    shards          INTEGER      NOT NULL DEFAULT 1,
    replicas        INTEGER      NOT NULL DEFAULT 0,
    last_reindexed_at TIMESTAMP NULL
);

-- Unique constraint on module
CREATE UNIQUE INDEX IF NOT EXISTS uq_global_search_configs_module
    ON global_search_configs(module) WHERE deleted_at IS NULL;

-- Indexer status records
CREATE TABLE IF NOT EXISTS global_search_indexer_status (
    id              BIGSERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ  NULL,
    module          VARCHAR(64)  NOT NULL,
    index_name      VARCHAR(128) NOT NULL,
    doc_count       BIGINT       NOT NULL DEFAULT 0,
    healthy         BOOLEAN      NOT NULL DEFAULT false,
    error           VARCHAR(512) NULL
);

-- Unique constraint on module
CREATE UNIQUE INDEX IF NOT EXISTS uq_global_search_indexer_status_module
    ON global_search_indexer_status(module) WHERE deleted_at IS NULL;

-- Seed default configurations for the three built-in indexers
INSERT INTO global_search_configs (module, index_name, enabled, full_text_field, refresh_interval)
VALUES
    ('ticket', 'ticket_v1', true, 'title', '5s'),
    ('alert', 'alert_v1', true, 'title', '3s'),
    ('cmdb', 'cmdb_v1', true, 'name', '30s')
ON CONFLICT ON CONSTRAINT uq_global_search_configs_module DO NOTHING;
