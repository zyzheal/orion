-- Resilience-Score module tables (auto-generated)

CREATE TABLE IF NOT EXISTS resilience_histories (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    timestamp BIGINT NOT NULL,
    overall_score BIGINT NOT NULL,
    level VARCHAR(255) NOT NULL,
    component_scores VARCHAR(255) NOT NULL,
    trigger VARCHAR(255) NOT NULL,
    details VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_resilience_histories_tenant ON resilience_histories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resilience_histories_created ON resilience_histories(created_at DESC);

CREATE TABLE IF NOT EXISTS resilience_recommendations (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    component VARCHAR(255) NOT NULL,
    priority VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    current_score BIGINT NOT NULL,
    potential_improvement BIGINT NOT NULL,
    effort VARCHAR(255) NOT NULL,
    impact VARCHAR(255) NOT NULL,
    actions VARCHAR(255) NOT NULL,
    references VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_resilience_recommendations_tenant ON resilience_recommendations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resilience_recommendations_created ON resilience_recommendations(created_at DESC);

CREATE TABLE IF NOT EXISTS resilience_benchmarks (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    timestamp BIGINT NOT NULL,
    current_score BIGINT NOT NULL,
    benchmark_score BIGINT NOT NULL,
    comparison VARCHAR(255) NOT NULL,
    analysis VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_resilience_benchmarks_tenant ON resilience_benchmarks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resilience_benchmarks_created ON resilience_benchmarks(created_at DESC);

