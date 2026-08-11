-- Migration 386: global-search tables (was AutoMigrate only)

CREATE TABLE IF NOT EXISTS global_search_configs (
    id SERIAL PRIMARY KEY,
    module VARCHAR(64) NOT NULL UNIQUE,
    index_name VARCHAR(128) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    full_text_field VARCHAR(64),
    refresh_interval VARCHAR(32),
    shards INT DEFAULT 1,
    replicas INT DEFAULT 0,
    last_reindexed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_search_configs_enabled ON global_search_configs(enabled);
CREATE INDEX IF NOT EXISTS idx_global_search_configs_module ON global_search_configs(module);

CREATE TABLE IF NOT EXISTS global_search_statuses (
    id SERIAL PRIMARY KEY,
    module VARCHAR(64) NOT NULL UNIQUE,
    index_name VARCHAR(128) NOT NULL,
    doc_count BIGINT DEFAULT 0,
    healthy BOOLEAN DEFAULT false,
    "error" TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_search_statuses_module ON global_search_statuses(module);
CREATE INDEX IF NOT EXISTS idx_global_search_statuses_healthy ON global_search_statuses(healthy);