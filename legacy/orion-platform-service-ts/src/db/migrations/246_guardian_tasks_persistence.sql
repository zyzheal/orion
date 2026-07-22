-- Guardian Tasks persistence
-- Migrates ExecutionGuardian active tasks from in-memory Map to PostgreSQL

CREATE TABLE IF NOT EXISTS guardian_tasks (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  task_id VARCHAR(255) NOT NULL,
  start_time BIGINT NOT NULL,
  global_timeout_ms INTEGER NOT NULL,
  step_timeout_ms INTEGER NOT NULL,
  aborted BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardian_tasks_tenant_id ON guardian_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guardian_tasks_task_id ON guardian_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_guardian_tasks_status ON guardian_tasks(status);
