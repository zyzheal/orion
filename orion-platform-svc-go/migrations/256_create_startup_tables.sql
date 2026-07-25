-- Migration 255: Startup Initialization Service tables
-- startup_modules and startup_dependencies for IStartup + StartupManager pattern.

CREATE TABLE IF NOT EXISTS startup_modules (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    name            VARCHAR(128) NOT NULL,
    type            VARCHAR(32) NOT NULL DEFAULT 'auto',  -- "auto", "lazy", "conditional"
    priority        INTEGER NOT NULL DEFAULT 0,
    description     TEXT,
    config          TEXT,              -- JSON string
    status          VARCHAR(32) NOT NULL DEFAULT 'pending', -- "pending", "initialized", "active", "error"
    error           TEXT,
    duration_ms     BIGINT NOT NULL DEFAULT 0,
    initialized_at  TIMESTAMPTZ NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_modules_tenant_name
    ON startup_modules(tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_startup_modules_tenant
    ON startup_modules(tenant_id);

CREATE INDEX IF NOT EXISTS idx_startup_modules_status
    ON startup_modules(tenant_id, status);

CREATE TABLE IF NOT EXISTS startup_dependencies (
    id          UUID PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    module_id   VARCHAR(128) NOT NULL,  -- references startup_modules.name
    depends_on  VARCHAR(128) NOT NULL,  -- name of module it depends on
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (tenant_id) REFERENCES startup_modules(tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_dependencies
    ON startup_dependencies(tenant_id, module_id, depends_on);

CREATE INDEX IF NOT EXISTS idx_startup_dependencies_tenant
    ON startup_dependencies(tenant_id);
