-- Migration 001: Config Management Service Core Tables
-- Creates all core tables for config items, versions, drifts, feature flags, approvals, and GitOps
-- Version: 1.0.0

-- ==================== Config Items ====================
CREATE TABLE IF NOT EXISTS config_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key               VARCHAR(255) NOT NULL,
  value             JSONB NOT NULL,
  item_type         VARCHAR(50) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'active',
  description       TEXT,
  app_id            VARCHAR(255),
  environment       VARCHAR(50) NOT NULL,
  current_version   INTEGER NOT NULL DEFAULT 1,
  tenant_id         UUID NOT NULL,
  created_by        VARCHAR(255) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_config_items_tenant ON config_items(tenant_id);
CREATE INDEX idx_config_items_key ON config_items(key);
CREATE INDEX idx_config_items_type ON config_items(item_type);
CREATE INDEX idx_config_items_status ON config_items(status);
CREATE INDEX idx_config_items_environment ON config_items(environment);
CREATE INDEX idx_config_items_app ON config_items(app_id);

-- ==================== Config Versions ====================
CREATE TABLE IF NOT EXISTS config_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id       UUID NOT NULL REFERENCES config_items(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  value           JSONB NOT NULL,
  change_reason   TEXT,
  changed_by      VARCHAR(255) NOT NULL,
  approval_id     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_config_versions_config ON config_versions(config_id);
CREATE INDEX idx_config_versions_version ON config_versions(config_id, version);

-- ==================== Config Drifts ====================
CREATE TABLE IF NOT EXISTS config_drifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id       UUID NOT NULL REFERENCES config_items(id) ON DELETE CASCADE,
  expected_value  JSONB NOT NULL,
  actual_value    JSONB NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'unknown',
  drifted_fields  JSONB NOT NULL DEFAULT '[]',
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id       UUID NOT NULL
);

CREATE INDEX idx_config_drifts_tenant ON config_drifts(tenant_id);
CREATE INDEX idx_config_drifts_config ON config_drifts(config_id);
CREATE INDEX idx_config_drifts_status ON config_drifts(status);
CREATE INDEX idx_config_drifts_detected ON config_drifts(detected_at);

-- ==================== Feature Flags ====================
CREATE TABLE IF NOT EXISTS feature_flags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key               VARCHAR(255) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'disabled',
  rollout_percentage INTEGER CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  target_user_ids   JSONB DEFAULT '[]',
  app_id            VARCHAR(255),
  environment       VARCHAR(50) NOT NULL,
  created_by        VARCHAR(255) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_flags_key ON feature_flags(key);
CREATE INDEX idx_feature_flags_environment ON feature_flags(environment);
CREATE INDEX idx_feature_flags_status ON feature_flags(status);
CREATE INDEX idx_feature_flags_app ON feature_flags(app_id);

-- ==================== Config Approvals ====================
CREATE TABLE IF NOT EXISTS config_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  changes         JSONB NOT NULL DEFAULT '[]',
  requester_id    VARCHAR(255) NOT NULL,
  approver_ids    JSONB NOT NULL DEFAULT '[]',
  comments        TEXT,
  tenant_id       UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at      TIMESTAMPTZ,
  decided_by      VARCHAR(255)
);

CREATE INDEX idx_config_approvals_tenant ON config_approvals(tenant_id);
CREATE INDEX idx_config_approvals_status ON config_approvals(status);
CREATE INDEX idx_config_approvals_requester ON config_approvals(requester_id);

-- ==================== GitOps Config ====================
CREATE TABLE IF NOT EXISTS gitops_config (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_url          VARCHAR(1000) NOT NULL,
  branch            VARCHAR(255) NOT NULL DEFAULT 'main',
  config_path       VARCHAR(500) NOT NULL,
  sync_strategy     VARCHAR(20) NOT NULL DEFAULT 'manual',
  last_sync_commit  VARCHAR(40),
  last_sync_at      TIMESTAMPTZ,
  sync_status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  tenant_id         UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gitops_config_tenant ON gitops_config(tenant_id);
CREATE INDEX idx_gitops_config_sync_status ON gitops_config(sync_status);

-- ==================== Migration Info ====================
CREATE TABLE IF NOT EXISTS config_mgmt_schema_migrations (
  version             VARCHAR(20) PRIMARY KEY,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  description         TEXT
);

INSERT INTO config_mgmt_schema_migrations (version, description)
VALUES ('001', 'Initial config management tables: config_items, versions, drifts, feature_flags, approvals, gitops');
