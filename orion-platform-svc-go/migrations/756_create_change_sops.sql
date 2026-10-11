-- Migration 756: Create change_sops table (ADR-015 §4.1)
-- 来源: docs/adr/ADR-015-Change-建模决策.md §4.1
-- 参考: reports/expert-reviews/neatlogic-change-event-firsthand-2026-10-03.md §2.2 ChangeSopVo
-- 目的: ADR-015 方案 A Change 三层 SOP 第 2 层 - 作业指导书 (SOP)
-- 兼容性: 新表, FK 引用 change_templates (755)
-- 编号: 756 (ADR-015 §4.1 明确指定)
-- 回滚: 756_create_change_sops_down.sql

BEGIN;

CREATE TABLE IF NOT EXISTS change_sops (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    template_id     UUID NOT NULL REFERENCES change_templates(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    authority       VARCHAR(50) NOT NULL DEFAULT 'public',
    sop_type        VARCHAR(50) NOT NULL DEFAULT 'standard',
    team_uuid       VARCHAR(255),
    version         INTEGER NOT NULL DEFAULT 1,
    created_by      VARCHAR(255) NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (tenant_id, template_id, name)
);

-- 按 tenant 查所有 SOP (List SOPs)
CREATE INDEX IF NOT EXISTS idx_change_sops_tenant
    ON change_sops (tenant_id);

-- 按 template 查关联 SOP (List SOPs by template)
CREATE INDEX IF NOT EXISTS idx_change_sops_template
    ON change_sops (template_id);

-- 按 is_active 快速过滤
CREATE INDEX IF NOT EXISTS idx_change_sops_active
    ON change_sops (tenant_id, is_active);

COMMENT ON TABLE change_sops IS
    'Change 作业指导书 (ADR-015 方案 A 三层 SOP 第 2 层); 对齐 NeatLogic ChangeSopVo; '
    'sop_type: standard/emergency/minor (NL constvalue 枚举)';

COMMENT ON COLUMN change_sops.template_id IS
    '关联 change_templates.id; 级联删除: 模板删除则其下所有 SOP 一并删除';

COMMENT ON COLUMN change_sops.authority IS
    '权限级别: public/team/private (NL authority constvalue)';

COMMENT ON COLUMN change_sops.sop_type IS
    'SOP 类型: standard (标准) / emergency (紧急) / minor (小型)';

COMMENT ON COLUMN change_sops.version IS
    '乐观锁版本号 (ADR-010 方案 C 风格): 每次 UPDATE 递增, 用于并发控制';

COMMIT;
