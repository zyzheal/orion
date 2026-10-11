-- Migration 755: Create change_templates table (ADR-015 §4.1)
-- 来源: docs/adr/ADR-015-Change-建模决策.md §4.1
-- 参考: reports/expert-reviews/neatlogic-change-event-firsthand-2026-10-03.md §2.2 ChangeTemplateVo
-- 目的: ADR-015 方案 A Change 三层 SOP 第 1 层 - 模板 (Template)
-- 兼容性: 新表, 不影响 tickets (758 才 ALTER)
-- 编号: 755 (ADR-015 §4.1 明确指定)
-- 回滚: 755_create_change_templates_down.sql

BEGIN;

CREATE TABLE IF NOT EXISTS change_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    authority       VARCHAR(50) NOT NULL DEFAULT 'public',
    template_type   VARCHAR(50) NOT NULL DEFAULT 'standard',
    team_uuid       VARCHAR(255),
    created_by      VARCHAR(255) NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (tenant_id, name)
);

-- 按 tenant 查所有模板 (List Templates)
CREATE INDEX IF NOT EXISTS idx_change_templates_tenant
    ON change_templates (tenant_id);

-- 按 is_active 快速过滤 (List Templates where is_active=true)
CREATE INDEX IF NOT EXISTS idx_change_templates_active
    ON change_templates (tenant_id, is_active);

-- team_uuid 若非空可按团队过滤
CREATE INDEX IF NOT EXISTS idx_change_templates_team
    ON change_templates (team_uuid) WHERE team_uuid IS NOT NULL;

COMMENT ON TABLE change_templates IS
    'Change 模板 (ADR-015 方案 A 三层 SOP 第 1 层); 对齐 NeatLogic ChangeTemplateVo; '
    'template_type: standard/emergency/minor (NL constvalue 枚举)';

COMMENT ON COLUMN change_templates.authority IS
    '权限级别: public/team/private (NL authority constvalue)';

COMMENT ON COLUMN change_templates.template_type IS
    '模板类型: standard (标准变更) / emergency (紧急) / minor (小型)';

COMMENT ON COLUMN change_templates.team_uuid IS
    '关联团队 UUID; 非空时仅该团队可见; NULL 表示公开';

COMMIT;
