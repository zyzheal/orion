-- Ai-Review module tables (auto-generated)

CREATE TABLE IF NOT EXISTS review_requests (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    content VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    score DOUBLE PRECISION NOT NULL,
    suggestions VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_review_requests_tenant ON review_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_created ON review_requests(created_at DESC);

