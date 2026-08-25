-- Migration: database_devops tables
-- Created: 2026-08-26

CREATE TABLE IF NOT EXISTS database_devops (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT DEFAULT '',
    type         TEXT NOT NULL DEFAULT 'backup', -- backup, restore, pitr, migration, vacuum
    status       TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    database_id  TEXT NOT NULL DEFAULT '',
    config       TEXT DEFAULT '{}',  -- JSON config
    result       TEXT DEFAULT '{}',  -- JSON result
    enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_database_devops_tenant ON database_devops(tenant_id);
CREATE INDEX IF NOT EXISTS idx_database_devops_status ON database_devops(status);
CREATE INDEX IF NOT EXISTS idx_database_devops_type ON database_devops(type);

CREATE TABLE IF NOT EXISTS database_sources (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    name         TEXT NOT NULL,
    type         TEXT NOT NULL DEFAULT 'postgres', -- postgres, mysql, clickhouse
    host         TEXT NOT NULL,
    port         INTEGER NOT NULL DEFAULT 5432,
    database     TEXT NOT NULL,
    username     TEXT NOT NULL,
    password     TEXT NOT NULL DEFAULT '',
    ssl_mode     TEXT NOT NULL DEFAULT 'disable',
    status       TEXT NOT NULL DEFAULT 'active', -- active, inactive, error
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_database_sources_tenant ON database_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_database_sources_type ON database_sources(type);
