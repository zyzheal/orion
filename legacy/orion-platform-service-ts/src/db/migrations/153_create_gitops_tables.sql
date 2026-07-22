-- Migration: 153_create_gitops_tables.sql
-- GitOps 配置和同步历史存储

CREATE TABLE IF NOT EXISTS gitops_configs (
  id UUID PRIMARY KEY,
  repo_url TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  config_path TEXT NOT NULL DEFAULT 'configs/',
  sync_interval INTEGER NOT NULL DEFAULT 300,
  last_sync TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'disabled',
  sync_direction TEXT NOT NULL DEFAULT 'git_to_platform',
  auto_apply BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_error TEXT
);

CREATE INDEX idx_gitops_configs_status ON gitops_configs(status);
CREATE INDEX idx_gitops_configs_repo_url ON gitops_configs(repo_url);

CREATE TABLE IF NOT EXISTS gitops_sync_history (
  id UUID PRIMARY KEY,
  gitops_config_id UUID NOT NULL REFERENCES gitops_configs(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  items_synced INTEGER NOT NULL DEFAULT 0,
  items_failed INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  drift_detected BOOLEAN NOT NULL DEFAULT false,
  drift_items JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_gitops_sync_history_config_id ON gitops_sync_history(gitops_config_id);
CREATE INDEX idx_gitops_sync_history_started_at ON gitops_sync_history(started_at DESC);