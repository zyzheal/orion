CREATE TABLE IF NOT EXISTS llm_models (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	provider VARCHAR(64) NOT NULL, model_name VARCHAR(128) NOT NULL, token_count BIGINT NOT NULL DEFAULT 0, cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0, latency_ms INT DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_llm_models_tenant ON llm_models(tenant_id, created_at);
