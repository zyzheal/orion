-- Migration 407: Saga Checkpoint Table
-- Provides saga transaction persistence for SagaCoordinator recovery
-- Enables process restart recovery for in-flight saga executions

-- ============================================
-- Saga Checkpoints
-- ============================================
CREATE TABLE IF NOT EXISTS saga_checkpoints (
  transaction_id UUID PRIMARY KEY,
  request_id UUID NOT NULL,
  saga_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  input JSONB DEFAULT '{}',
  output JSONB,
  error TEXT,
  metadata JSONB DEFAULT '{}',
  step_executions JSONB DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saga_checkpoints_request_id ON saga_checkpoints(request_id);
CREATE INDEX IF NOT EXISTS idx_saga_checkpoints_saga_name ON saga_checkpoints(saga_name);
CREATE INDEX IF NOT EXISTS idx_saga_checkpoints_status ON saga_checkpoints(status);
CREATE INDEX IF NOT EXISTS idx_saga_checkpoints_created_at ON saga_checkpoints(created_at DESC);

-- Row Level Security
ALTER TABLE saga_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_saga_checkpoints ON saga_checkpoints
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND (metadata->>'tenantId')::text = current_setting('app.current_tenant_id')
    );
