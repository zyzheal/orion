-- Tool center persistence
--
-- Four tables are referenced by internal/tool/repository but were never created
-- anywhere in migrations/:
--     tools
--     tool_categories
--     tool_versions
--     tool_invocations
-- so the repository INSERTed into relations that do not exist and the driver
-- failed on every call. That made the entire module permanently unreachable:
--     POST   /api/v1/tools             -> 500 "relation does not exist"
--     GET    /api/v1/tools             -> 500 "relation does not exist"
--     GET    /api/v1/tools/:id         -> 500
--     POST   /api/v1/tools/:id/invocations  -> 500
--     GET    /api/v1/tools/:id/invocations  -> 500
--     GET    /api/v1/tools/:id/versions     -> 500
--     POST   /api/v1/tools/:id/versions     -> 500
--     GET    /api/v1/categories        -> 500
--     GET    /api/v1/invocations/:id   -> 500
--     GET    /api/v1/tools/stats       -> 500
--     GET    /api/v1/tools/:id/stats   -> 500
--     GET    /api/v1/tools/top         -> 500
--     GET    /api/v1/tools/search      -> 500
--     GET    /api/v1/tools/market      -> 500
-- and the two repository canary statements that did run (SELECT COUNT(*) FROM
-- tools, SELECT * FROM tool_categories) failed the same way.
--
-- The shapes follow the columns the repository actually binds:
--   ToolRepository.Create          -> tools (INSERT with :id, :tenant_id, :name,
--                                     :display_name, :description, :category,
--                                     :type, :version, :config, :endpoint,
--                                     :auth_type, :auth_config, :tags, :status,
--                                     :created_by)
--   ToolRepository.GetByID         -> id, tenant_id  (WHERE ... AND tenant_id=$2)
--   ToolRepository.Update          -> display_name, description, category,
--                                     version, config, endpoint, auth_type,
--                                     auth_config, tags, status, updated_at
--   InvocationRepository.Create    -> tool_invocations (id, tool_id, tenant_id,
--                                     input, output, status, error, duration,
--                                     called_by)
--   VersionRepository.Create       -> tool_versions (id, tool_id, version,
--                                     config, changelog, created_by)
--   VersionRepository.ListByTool   -> tool_versions WHERE tool_id=$1
--
-- id / tenant_id / tool_id are UUID-type columns holding string values the Go
-- service generates with uuid.New().String() and passes through untouched.
-- Postgres casts the string to UUID on the wire; declaring the columns UUID
-- keeps them comparable and indexable, matching every sibling table in the
-- platform and 239_unify_tenant_id_to_uuid.sql.
--
-- auth_config holds the caller's JSON blob ({"api_key": "..."} or similar) and
-- is TEXT: the service reads the key at invocation time and must be able to
-- store whatever shape the caller supplied without the driver parsing it.
-- config and tags are TEXT JSON for the same reason.
--
-- tool_versions deliberately has no tenant_id column: it is reached only
-- through a parent tool owned by the caller's tenant (the service resolves the
-- tool with a tenant-scoped GetByID first), so tenant filtering happens through
-- the parent row. The versions query itself is scoped by tool_id alone.

CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    category VARCHAR(100) NOT NULL DEFAULT '',
    type VARCHAR(50) NOT NULL DEFAULT '',
    version VARCHAR(100) NOT NULL DEFAULT '',
    config TEXT NOT NULL DEFAULT '{}',
    endpoint VARCHAR(1024) NOT NULL DEFAULT '',
    auth_type VARCHAR(50) NOT NULL DEFAULT 'none',
    auth_config TEXT NOT NULL DEFAULT '{}',
    tags TEXT NOT NULL DEFAULT '[]',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deprecated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_tools_tenant ON tools(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tools_tenant_name ON tools(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_tools_tenant_category ON tools(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_tools_tenant_status ON tools(tenant_id, status);

CREATE TABLE IF NOT EXISTS tool_categories (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    icon VARCHAR(255) NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_categories_tenant ON tool_categories(tenant_id);

CREATE TABLE IF NOT EXISTS tool_versions (
    id UUID PRIMARY KEY,
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    version VARCHAR(100) NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    changelog TEXT NOT NULL DEFAULT '',
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_versions_tool ON tool_versions(tool_id);

CREATE TABLE IF NOT EXISTS tool_invocations (
    id UUID PRIMARY KEY,
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    input TEXT NOT NULL DEFAULT '{}',
    output TEXT NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'success',
    error TEXT,
    duration BIGINT NOT NULL DEFAULT 0,
    called_by VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_invocations_tenant ON tool_invocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tool_invocations_tenant_tool ON tool_invocations(tenant_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_invocations_created_at ON tool_invocations(created_at DESC);