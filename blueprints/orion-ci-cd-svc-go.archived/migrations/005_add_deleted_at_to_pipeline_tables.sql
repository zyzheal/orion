-- Migration 005: Add deleted_at column for soft delete support
-- Phase 5.5: 软删除统一方案
-- 修复: 代码中已使用 deleted_at 但迁移文件缺失的 GAP

-- Pipeline definitions
ALTER TABLE pipelines ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Pipeline runs (not soft-deletable, runs are append-only history)
-- Pipeline version history
ALTER TABLE pipeline_versions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Pipeline triggers
ALTER TABLE pipeline_triggers ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- RBAC groups (created in pipeline_002)
ALTER TABLE rbac_groups ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Pipeline templates (created in pipeline_002)
ALTER TABLE pipeline_templates ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Template versions (created in pipeline_002)
ALTER TABLE template_versions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Approval gates (created in pipeline_002)
ALTER TABLE approval_gates ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Budget policies (created in pipeline_003)
ALTER TABLE budget_policies ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Phase groups (created in pipeline_003)
ALTER TABLE phase_groups ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Build budgets (created in pipeline_003)
ALTER TABLE build_budgets ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Autonomous control policies (created in pipeline_004)
ALTER TABLE autonomous_control_policies ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Autonomous incidents (created in pipeline_004)
ALTER TABLE autonomous_incidents ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index on deleted_at for efficient soft delete queries
CREATE INDEX IF NOT EXISTS idx_pipelines_deleted_at ON pipelines(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_versions_deleted_at ON pipeline_versions(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_deleted_at ON pipeline_triggers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_deleted_at ON pipeline_templates(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_template_versions_deleted_at ON template_versions(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_approval_gates_deleted_at ON approval_gates(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_budget_policies_deleted_at ON budget_policies(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_phase_groups_deleted_at ON phase_groups(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_autonomous_control_policies_deleted_at ON autonomous_control_policies(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_autonomous_incidents_deleted_at ON autonomous_incidents(deleted_at) WHERE deleted_at IS NULL;
