-- Process Registry persistence
-- Migrates ProcessKiller from in-memory Map to PostgreSQL

CREATE TABLE IF NOT EXISTS process_registry (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
  task_id VARCHAR(255) NOT NULL,
  pid INTEGER NOT NULL,
  pgid INTEGER,
  container_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_process_registry_tenant_id ON process_registry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_process_registry_task_id ON process_registry(task_id);
CREATE INDEX IF NOT EXISTS idx_process_registry_status ON process_registry(status);
