-- 003_create_saga_tables.sql
-- Saga 分布式事务编排表
-- 用于 SagaCoordinator 协调跨服务的分布式事务

CREATE TABLE IF NOT EXISTS saga_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    saga_name TEXT NOT NULL,
    request_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, compensating, compensated, failed
    input JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    current_step INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saga_transactions_tenant_id ON saga_transactions(tenant_id);
CREATE INDEX idx_saga_transactions_request_id ON saga_transactions(request_id);
CREATE INDEX idx_saga_transactions_status ON saga_transactions(status);
CREATE INDEX idx_saga_transactions_saga_name ON saga_transactions(saga_name);

CREATE TABLE IF NOT EXISTS saga_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    transaction_id UUID NOT NULL REFERENCES saga_transactions(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, executing, completed, compensating, compensated, failed, compensation_failed
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB,
    error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    compensation_started_at TIMESTAMPTZ,
    compensation_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saga_steps_tenant_id ON saga_steps(tenant_id);
CREATE INDEX idx_saga_steps_transaction_id ON saga_steps(transaction_id);
CREATE INDEX idx_saga_steps_status ON saga_steps(status);
