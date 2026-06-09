-- Migration 257: Model Custom Pricing Persistence
-- Migrates CostCalculator's in-memory Map<string, { input, output }> to PostgreSQL

CREATE TABLE IF NOT EXISTS model_custom_pricing (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    input_price NUMERIC(12, 6) NOT NULL DEFAULT 0,
    output_price NUMERIC(12, 6) NOT NULL DEFAULT 0,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_model_custom_pricing_model_id ON model_custom_pricing(model_id);
CREATE INDEX IF NOT EXISTS idx_model_custom_pricing_tenant_id ON model_custom_pricing(tenant_id);

COMMENT ON TABLE model_custom_pricing IS 'Custom LLM model pricing overrides (migrated from CostCalculator in-memory Map)';
