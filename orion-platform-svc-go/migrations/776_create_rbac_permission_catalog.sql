-- Migration 776: RBAC Permission Catalog — 权限目录
CREATE TABLE IF NOT EXISTS rbac_permission_catalog (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module          TEXT NOT NULL,
    resource        TEXT NOT NULL,
    action          TEXT NOT NULL,
    -- create, read, update, delete, admin
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (module, resource, action)
);
CREATE INDEX idx_rbac_permission_module ON rbac_permission_catalog(module);
