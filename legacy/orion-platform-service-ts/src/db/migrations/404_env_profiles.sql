-- Environment Profiles table (Task 9)
-- Environment-specific configuration profiles with variable sets
-- Mirrors NeatLogic's Profile management pattern

CREATE TABLE IF NOT EXISTS env_profiles (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name VARCHAR(255) NOT NULL,
    environment VARCHAR(64) NOT NULL,  -- development | staging | production
    variables JSONB DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- A profile is unique per (tenant, name, environment) combination
    CONSTRAINT unique_profile_per_tenant_env UNIQUE (tenant_id, name, environment)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_env_profiles_tenant ON env_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_env_profiles_name ON env_profiles(name);
CREATE INDEX IF NOT EXISTS idx_env_profiles_environment ON env_profiles(environment);
CREATE INDEX IF NOT EXISTS idx_env_profiles_created ON env_profiles(created_at DESC);

-- Composite index for the unique lookup (tenant + name + environment)
CREATE INDEX IF NOT EXISTS idx_env_profiles_tenant_name_env
  ON env_profiles(tenant_id, name, environment);

-- Row Level Security
ALTER TABLE env_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_env_profiles ON env_profiles
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );
