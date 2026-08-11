-- API Component module tables — component registry + route definitions
-- Migration 379

CREATE TABLE IF NOT EXISTS api_components (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    version VARCHAR(32) DEFAULT 'v1',
    summary TEXT,
    description TEXT,
    tags JSONB DEFAULT '[]'::JSONB,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_components_name ON api_components(name);
CREATE INDEX IF NOT EXISTS idx_api_components_version ON api_components(version);
CREATE INDEX IF NOT EXISTS idx_api_components_created ON api_components(created_at DESC);

CREATE TABLE IF NOT EXISTS api_component_routes (
    id VARCHAR(36) PRIMARY KEY,
    component_name VARCHAR(128) NOT NULL,
    path TEXT NOT NULL,
    methods JSONB NOT NULL DEFAULT '["GET"]'::JSONB,
    summary TEXT,
    description TEXT,
    handler_ref VARCHAR(256),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_api_component_routes FOREIGN KEY (component_name) REFERENCES api_components(name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_component_routes_comp ON api_component_routes(component_name);
CREATE INDEX IF NOT EXISTS idx_api_component_routes_path ON api_component_routes(path);