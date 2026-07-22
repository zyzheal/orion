-- Migration: Create saga_instances table for distributed transactions
-- Stores saga instances and their step execution state

CREATE TABLE IF NOT EXISTS saga_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saga_type VARCHAR(64) NOT NULL,
    tenant_id UUID NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    current_step INTEGER DEFAULT 1,
    total_steps INTEGER NOT NULL,
    context JSONB DEFAULT '{}',
    steps JSONB DEFAULT '[]',
    compensation_log JSONB DEFAULT '[]',
    correlation_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saga_instances_tenant ON saga_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saga_instances_status ON saga_instances(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_saga_instances_type ON saga_instances(saga_type, tenant_id);
