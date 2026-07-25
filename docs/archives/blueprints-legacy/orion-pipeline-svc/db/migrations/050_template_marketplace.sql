-- Migration: 050_template_marketplace.sql
-- Description: Add template marketplace fields and cache strategies table

-- ============================================
-- Template Marketplace Tables
-- ============================================

-- Extend pipeline_templates table with marketplace fields
ALTER TABLE pipeline_templates
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS author VARCHAR(255),
ADD COLUMN IF NOT EXISTS thumbnail TEXT,
ADD COLUMN IF NOT EXISTS readme TEXT;

-- Create template_ratings table
CREATE TABLE IF NOT EXISTS template_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES pipeline_templates(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    rated_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for template ratings
CREATE INDEX IF NOT EXISTS idx_template_ratings_template_id ON template_ratings(template_id);
CREATE INDEX IF NOT EXISTS idx_template_ratings_tenant_id ON template_ratings(tenant_id);

-- Create template_categories table
CREATE TABLE IF NOT EXISTS template_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(100),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO template_categories (name, description, icon, display_order) VALUES
    ('language', 'Programming language templates', 'code', 1),
    ('platform', 'Platform-specific templates', 'cloud', 2),
    ('purpose', 'Purpose-specific templates', 'target', 3),
    ('custom', 'Custom user templates', 'folder', 4)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Visual Pipeline Tables
-- ============================================

-- Create visual_pipelines table
CREATE TABLE IF NOT EXISTS visual_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    pipeline_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    layout JSONB NOT NULL DEFAULT '{"stages": [], "viewport": {"x": 0, "y": 0, "zoom": 1}}',
    yaml_definition TEXT NOT NULL,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for visual_pipelines
CREATE INDEX IF NOT EXISTS idx_visual_pipelines_tenant_id ON visual_pipelines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visual_pipelines_pipeline_id ON visual_pipelines(pipeline_id);

-- ============================================
-- Cache Strategy Tables
-- ============================================

-- Create cache_strategies table
CREATE TABLE IF NOT EXISTS cache_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('npm', 'pip', 'maven', 'gradle', 'custom')),
    key_template VARCHAR(500) NOT NULL,
    paths TEXT[] NOT NULL,
    restore_keys TEXT[] DEFAULT '{}',
    max_age INTEGER NOT NULL DEFAULT 86400,
    enabled BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for cache_strategies
CREATE INDEX IF NOT EXISTS idx_cache_strategies_tenant_id ON cache_strategies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cache_strategies_type ON cache_strategies(type);

-- Create cache_stats table
CREATE TABLE IF NOT EXISTS cache_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    strategy_id UUID NOT NULL REFERENCES cache_strategies(id) ON DELETE CASCADE,
    hits INTEGER DEFAULT 0,
    misses INTEGER DEFAULT 0,
    size_bytes BIGINT DEFAULT 0,
    last_hit_at TIMESTAMP WITH TIME ZONE,
    last_warm_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, strategy_id)
);

-- Create indexes for cache_stats
CREATE INDEX IF NOT EXISTS idx_cache_stats_tenant_id ON cache_stats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cache_stats_strategy_id ON cache_stats(strategy_id);