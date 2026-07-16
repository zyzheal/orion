-- Migration 025: Ephemeral Development Environments Tables
-- Creates tables for ephemeral environment management, templates, and data seeding

-- 临时环境主表
CREATE TABLE IF NOT EXISTS ephemeral_environments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id           VARCHAR(100) NOT NULL,
  repo_id         VARCHAR(100) NOT NULL,
  branch_name     VARCHAR(255) NOT NULL,
  namespace       VARCHAR(63) NOT NULL UNIQUE,
  template_id     UUID,
  status          VARCHAR(20) NOT NULL DEFAULT 'provisioning',
  preview_url     VARCHAR(255),
  commit_sha      VARCHAR(40),
  resources       JSONB,
  services        JSONB DEFAULT '[]',
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  idle_since      TIMESTAMPTZ,
  auto_destroy_at TIMESTAMPTZ,
  destroyed_at    TIMESTAMPTZ,
  destroy_reason  VARCHAR(100)
);
CREATE INDEX idx_eph_env_pr ON ephemeral_environments(pr_id, repo_id);
CREATE INDEX idx_eph_env_status ON ephemeral_environments(status);
CREATE INDEX idx_eph_env_namespace ON ephemeral_environments(namespace);
CREATE INDEX idx_eph_env_created_at ON ephemeral_environments(created_at DESC);

-- 环境模板表
CREATE TABLE IF NOT EXISTS environment_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100) NOT NULL UNIQUE,
  description      TEXT,
  services         JSONB NOT NULL,
  dependencies     JSONB,
  data_seed_config JSONB,
  network_policies JSONB,
  resource_limits  JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 数据种子配置表
CREATE TABLE IF NOT EXISTS data_seed_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env_id          UUID NOT NULL REFERENCES ephemeral_environments(id) ON DELETE CASCADE,
  seed_type       VARCHAR(50) NOT NULL,
  seed_data       JSONB NOT NULL,
  applied_at      TIMESTAMPTZ,
  applied_status  VARCHAR(20) DEFAULT 'pending',
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_seed_env ON data_seed_configs(env_id);

-- 依赖 Mock 配置表
CREATE TABLE IF NOT EXISTS dependency_mocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env_id          UUID NOT NULL REFERENCES ephemeral_environments(id) ON DELETE CASCADE,
  service_name    VARCHAR(100) NOT NULL,
  mock_type       VARCHAR(50) NOT NULL,
  mock_config     JSONB NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mock_env ON dependency_mocks(env_id);

-- Rollback:
-- DROP TABLE IF EXISTS dependency_mocks, data_seed_configs, environment_templates, ephemeral_environments;
