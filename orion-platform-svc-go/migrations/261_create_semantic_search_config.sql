-- Migration 261: Add semantic_search_config table for hybrid search tuning

BEGIN;

CREATE TABLE IF NOT EXISTS semantic_search_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default' UNIQUE,
    hybrid_enabled BOOLEAN NOT NULL DEFAULT true,
    vector_weight DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    keyword_weight DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    rrf_enabled BOOLEAN NOT NULL DEFAULT true,
    rrf_k INTEGER NOT NULL DEFAULT 60,
    vector_top_k INTEGER NOT NULL DEFAULT 100,
    keyword_top_k INTEGER NOT NULL DEFAULT 100,
    min_score_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default config row
INSERT INTO semantic_search_config (id, tenant_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'default')
ON CONFLICT (tenant_id) DO NOTHING;

COMMIT;
