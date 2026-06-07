-- LLM Traces: tracks every LLM API call with prompt, output, tokens, and cost
CREATE TABLE IF NOT EXISTS llm_traces (
    id             BIGSERIAL PRIMARY KEY,
    trace_id       VARCHAR(128)  NOT NULL UNIQUE,
    tenant_id      VARCHAR(64)   NOT NULL,
    user_id        VARCHAR(128),
    scenario_id    VARCHAR(128),
    provider_id    VARCHAR(128),
    model_id       VARCHAR(128)  NOT NULL,
    prompt_content TEXT,
    prompt_hash    VARCHAR(128),
    output_content TEXT,
    output_hash    VARCHAR(128),
    input_tokens   BIGINT        NOT NULL DEFAULT 0,
    output_tokens  BIGINT        NOT NULL DEFAULT 0,
    total_tokens   BIGINT        NOT NULL DEFAULT 0,
    input_cost     DOUBLE PRECISION NOT NULL DEFAULT 0,
    output_cost    DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_cost     DOUBLE PRECISION NOT NULL DEFAULT 0,
    currency       VARCHAR(8)    NOT NULL DEFAULT 'CNY',
    status         VARCHAR(16)   NOT NULL DEFAULT 'pending',
    request_started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_completed_at TIMESTAMPTZ,
    duration_ms    BIGINT,
    parent_trace_id VARCHAR(128),
    error_message  TEXT,
    request_context JSONB        DEFAULT '{}',
    metadata       JSONB,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_traces_tenant    ON llm_traces(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_traces_scenario  ON llm_traces(scenario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_traces_status    ON llm_traces(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_traces_date      ON llm_traces((DATE(request_started_at)));

-- Model Custom Pricing: allows tenants to override default per-model token pricing
CREATE TABLE IF NOT EXISTS model_custom_pricing (
    id           VARCHAR(128) PRIMARY KEY,
    model_id     VARCHAR(128) NOT NULL,
    input_price  DOUBLE PRECISION NOT NULL DEFAULT 0,
    output_price DOUBLE PRECISION NOT NULL DEFAULT 0,
    tenant_id    VARCHAR(64),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_model_custom_pricing_model
    ON model_custom_pricing(model_id);
