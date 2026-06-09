-- Queue Jobs Table — Generic task queue for async job processing

CREATE TABLE IF NOT EXISTS queue_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  queue_name VARCHAR(128) NOT NULL DEFAULT 'default',
  job_type VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  result JSONB,
  error_message TEXT,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for priority-based dequeue (highest priority first, then oldest)
CREATE INDEX IF NOT EXISTS idx_queue_jobs_dequeue
  ON queue_jobs (status, priority DESC, created_at ASC)
  WHERE status = 'pending';

-- Index for retry scheduling
CREATE INDEX IF NOT EXISTS idx_queue_jobs_retry
  ON queue_jobs (status, next_retry_at)
  WHERE status = 'failed';

-- Index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_queue_jobs_tenant
  ON queue_jobs (tenant_id, status, created_at DESC);

-- Index for queue name filtering
CREATE INDEX IF NOT EXISTS idx_queue_jobs_queue_name
  ON queue_jobs (queue_name, status);
