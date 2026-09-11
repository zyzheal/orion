-- Bootstrap: foundational tables that many later migrations reference by
-- foreign key BEFORE the numbered migration that creates them runs.
--
-- Migrations are applied in file-name lexicographic order by
-- internal/devops/migration_runner.go, and the runner aborts on the first
-- error. Several CREATE TABLE statements before 075 reference tenants(id)
-- (api_keys 008, event_triggers 037, events 038, hook_chains 045,
-- permissions 058, roles 065, sessions 069). Those statements used to fail
-- with 'relation "tenants" does not exist', which aborted the whole run and
-- prevented 075 (the migration that actually creates tenants) from ever
-- running -- so every migration after 008 was skipped silently.
--
-- This file declares the same shape 075 declares (id UUID, matching the
-- tenant_id UUID type every referencing migration uses, and which
-- 239_unify_tenant_id_to_uuid also assumes). 075 keeps its own
-- CREATE TABLE IF NOT EXISTS so existing deployments stay untouched.

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
-- 补齐 tenants：189_create_tenant-gateway_tables.sql 的定义晚于 000_bootstrap_foundational_tables.sql，按序执行时表已存在
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL, ADD COLUMN IF NOT EXISTS tier VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS namespace_pool_id VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS business_unit VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS cost_center VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS expires_at BIGINT, ADD COLUMN IF NOT EXISTS metadata JSONB, ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;



CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_name ON tenants(name);

-- users: same reasoning, except 077_create_user_tables.sql is the numbered
-- creator. 008_create_api_key_tables.sql is the only FK forward reference in
-- the whole migrations directory (verified by scanning every REFERENCES clause
-- against the CREATE TABLE inventory), and it comes 69 files before 077.
-- Because the runner aborts on the first error, 008 used to fail with
-- 'relation "users" does not exist', which also prevented api_keys from ever
-- being created -- and 241/242 then failed too, since they ALTER api_keys.
--
-- Mirrors 077's definition exactly; 077 keeps its own CREATE TABLE IF NOT
-- EXISTS so existing deployments are untouched.
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    password TEXT,
    avatar_url TEXT,
    settings TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
