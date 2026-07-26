-- Builder Images table
CREATE TABLE IF NOT EXISTS builder_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    image VARCHAR(500) NOT NULL,
    type VARCHAR(50) DEFAULT 'custom',
    version VARCHAR(100) DEFAULT 'latest',
    description TEXT,
    pull_policy VARCHAR(50) DEFAULT 'IfNotPresent',
    status VARCHAR(50) DEFAULT 'active',
    is_preset BOOLEAN DEFAULT FALSE,
    env JSONB DEFAULT '{}',
    labels JSONB DEFAULT '{}',
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_builder_images_name ON builder_images (name);
CREATE INDEX IF NOT EXISTS idx_builder_images_type ON builder_images (type);
CREATE INDEX IF NOT EXISTS idx_builder_images_status ON builder_images (status);

-- Build Cache Configs table
CREATE TABLE IF NOT EXISTS build_cache_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level VARCHAR(50) NOT NULL,
    target_id UUID,
    status VARCHAR(50) DEFAULT 'enabled',
    storage_type VARCHAR(50) DEFAULT 'local-volume',
    storage_path VARCHAR(1000),
    max_total_size VARCHAR(50),
    max_age_days INTEGER DEFAULT 30,
    cleanup_policy VARCHAR(50) DEFAULT 'lru',
    cache_key_pattern VARCHAR(500),
    cache_paths TEXT DEFAULT '[]',
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_build_cache_configs_level_target ON build_cache_configs (level, target_id) WHERE target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_build_cache_configs_level ON build_cache_configs (level) WHERE target_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_build_cache_configs_status ON build_cache_configs (status);

-- Cache Entries table
CREATE TABLE IF NOT EXISTS cache_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES build_cache_configs(id) ON DELETE CASCADE,
    cache_key VARCHAR(500) NOT NULL,
    hash VARCHAR(128) NOT NULL,
    size BIGINT DEFAULT 0,
    storage_path VARCHAR(1000) NOT NULL,
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_entries_config_key ON cache_entries (config_id, cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_entries_config_id ON cache_entries (config_id);
CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries (expires_at) WHERE expires_at IS NOT NULL;
