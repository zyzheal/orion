-- Migration 172: ChatOps Question & Command Configs
-- Tables for user-specific chat question cards and quick command configurations

-- ChatOps Question Configs (问答卡片配置)
CREATE TABLE IF NOT EXISTS chatops_question_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR(255) NOT NULL,
  key             VARCHAR(100) NOT NULL,
  icon            VARCHAR(100) NOT NULL DEFAULT '',
  title           VARCHAR(200) NOT NULL DEFAULT '',
  description     VARCHAR(500) NOT NULL DEFAULT '',
  question        TEXT NOT NULL DEFAULT '',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
CREATE INDEX idx_chatops_question_configs_user ON chatops_question_configs(user_id);
CREATE INDEX idx_chatops_question_configs_enabled ON chatops_question_configs(user_id, enabled);
COMMENT ON TABLE chatops_question_configs IS 'ChatOps user-specific question card configurations';

-- ChatOps Command Configs (快捷命令配置)
CREATE TABLE IF NOT EXISTS chatops_command_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR(255) NOT NULL,
  key             VARCHAR(100) NOT NULL,
  label           VARCHAR(200) NOT NULL DEFAULT '',
  command         TEXT NOT NULL DEFAULT '',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
CREATE INDEX idx_chatops_command_configs_user ON chatops_command_configs(user_id);
CREATE INDEX idx_chatops_command_configs_enabled ON chatops_command_configs(user_id, enabled);
COMMENT ON TABLE chatops_command_configs IS 'ChatOps user-specific quick command configurations';
