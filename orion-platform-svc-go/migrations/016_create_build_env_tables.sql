-- Build-env module tables

CREATE TABLE IF NOT EXISTS builds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    pipeline_id VARCHAR(255),
    product_line_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_builds_tenant_id ON builds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_builds_status ON builds(status);

CREATE TABLE IF NOT EXISTS build_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    image_tag VARCHAR(255),
    base_image VARCHAR(255),
    dockerfile TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_build_images_tenant_id ON build_images(tenant_id);

CREATE TABLE IF NOT EXISTS build_cache_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    level VARCHAR(50) NOT NULL DEFAULT 'local',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    cache_dir VARCHAR(255),
    ttl_hours BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_build_cache_configs_tenant_id ON build_cache_configs(tenant_id);

CREATE TABLE IF NOT EXISTS build_cache_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id BIGINT NOT NULL,
    key VARCHAR(255) NOT NULL,
    value JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_build_cache_entries_config_id ON build_cache_entries(config_id);
CREATE INDEX IF NOT EXISTS idx_build_cache_entries_key ON build_cache_entries(key);

CREATE TABLE IF NOT EXISTS build_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    build_id VARCHAR(255) NOT NULL,
    log_data TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_build_logs_tenant_id ON build_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_build_logs_build_id ON build_logs(build_id);
