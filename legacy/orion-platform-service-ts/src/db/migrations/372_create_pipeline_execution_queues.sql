-- Migration 372: Create pipeline_execution_queues table
-- 用于 PipelineExecutionQueue PostgreSQL 持久化，支持崩溃恢复和状态查询

CREATE TABLE IF NOT EXISTS pipeline_execution_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id UUID,
  run_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_pipeline_queue_tenant ON pipeline_execution_queues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_queue_status ON pipeline_execution_queues(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_queue_priority ON pipeline_execution_queues(priority DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_queue_queued ON pipeline_execution_queues(queued_at ASC);
