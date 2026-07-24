-- Migration 046: ChatOps Admin Tables (Capability Mapping & Approval Config)
-- Creates tables for ChatOps admin API: capability mappings and approval configurations

-- ChatOps Capability Mapping (命令-Capability 映射)
CREATE TABLE IF NOT EXISTS chatops_capability_mappings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id        VARCHAR(100) NOT NULL,
  capability_id     VARCHAR(255) NOT NULL,
  environment       VARCHAR(50),                        -- NULL means all environments
  risk_level        INTEGER NOT NULL DEFAULT 0,         -- 0-5 risk level
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(command_id, environment)
);
CREATE INDEX idx_chatops_capability_mappings_command ON chatops_capability_mappings(command_id);
CREATE INDEX idx_chatops_capability_mappings_capability ON chatops_capability_mappings(capability_id);
CREATE INDEX idx_chatops_capability_mappings_env ON chatops_capability_mappings(environment);
COMMENT ON TABLE chatops_capability_mappings IS 'ChatOps command to global Capability mapping for RBAC';

-- ChatOps Approval Config (审批配置)
CREATE TABLE IF NOT EXISTS chatops_approval_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability        VARCHAR(255) NOT NULL UNIQUE,
  enabled           BOOLEAN NOT NULL DEFAULT false,
  approvers         JSONB NOT NULL DEFAULT '[]',       -- Array of user IDs
  threshold         INTEGER NOT NULL DEFAULT 1,         -- Number of required approvers
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chatops_approval_configs_capability ON chatops_approval_configs(capability);
COMMENT ON TABLE chatops_approval_configs IS 'ChatOps approval configuration per Capability';

-- ChatOps Approver Schedule (审批人值班表)
CREATE TABLE IF NOT EXISTS chatops_approver_schedule (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR(255) NOT NULL,
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chatops_approver_schedule_user ON chatops_approver_schedule(user_id);
CREATE INDEX idx_chatops_approver_schedule_time ON chatops_approver_schedule(start_time, end_time);
COMMENT ON TABLE chatops_approver_schedule IS 'ChatOps approver on-call schedule';

-- System Config (already exists in 016, but ensure chatops.approval.global key)
-- This is handled by CapabilityMappingService on first run if not exists