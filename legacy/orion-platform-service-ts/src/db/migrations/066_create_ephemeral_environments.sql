-- Ephemeral Environments Persistence Migration
-- Creates table for ephemeral development environments

CREATE TABLE IF NOT EXISTS ephemeral_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id VARCHAR(255) NOT NULL,
  repo_id VARCHAR(255) NOT NULL,
  branch_name VARCHAR(255) NOT NULL,
  namespace VARCHAR(63) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'provisioning',
  preview_url TEXT,
  commit_sha VARCHAR(40),
  resources JSONB NOT NULL DEFAULT '{"cpu": "2", "memory": "4Gi", "storage": "10Gi"}',
  services JSONB DEFAULT '[]',
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  idle_since TIMESTAMP WITH TIME ZONE,
  auto_destroy_at TIMESTAMP WITH TIME ZONE,
  destroyed_at TIMESTAMP WITH TIME ZONE,
  destroy_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_ephemeral_env_pr ON ephemeral_environments(pr_id);
CREATE INDEX IF NOT EXISTS idx_ephemeral_env_repo ON ephemeral_environments(repo_id);
CREATE INDEX IF NOT EXISTS idx_ephemeral_env_status ON ephemeral_environments(status);
CREATE INDEX IF NOT EXISTS idx_ephemeral_env_created ON ephemeral_environments(created_at DESC);
