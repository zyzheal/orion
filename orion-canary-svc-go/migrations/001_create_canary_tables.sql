CREATE TABLE IF NOT EXISTS canaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    deployment_id VARCHAR(255) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    weight INT NOT NULL DEFAULT 10,
    target_weight INT NOT NULL DEFAULT 100,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_canaries_tenant_id ON canaries(tenant_id);
CREATE INDEX idx_canaries_status ON canaries(status);
CREATE INDEX idx_canaries_service ON canaries(service_name);

CREATE TABLE IF NOT EXISTS canary_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canary_id UUID NOT NULL REFERENCES canaries(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    source VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_canary_metrics_canary_id ON canary_metrics(canary_id);
