-- Migration 758: ALTER tickets ADD change_template_id + change_sop_id (ADR-015 §4.1)
-- 来源: docs/adr/ADR-015-Change-建模决策.md §4.1
-- 参考: reports/expert-reviews/neatlogic-change-event-firsthand-2026-10-03.md §2.1 ChangeRequestVo.changeTemplateId/changeSopId
-- 目的: ADR-015 方案 A - 变更请求 (ChangeRequest/ticket) 引用其选择的模板 + SOP
-- 兼容性: 新增列 nullable, 不影响现有 ticket
-- 编号: 758 (ADR-015 §4.1 明确指定)
-- 回滚: 758_tickets_add_change_template_down.sql

BEGIN;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS change_template_id UUID;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS change_sop_id UUID;

-- 按模板查其下的所有变更 (List Changes by Template)
CREATE INDEX IF NOT EXISTS idx_tickets_change_template
    ON tickets (change_template_id) WHERE change_template_id IS NOT NULL;

-- 按 SOP 查其下的所有变更 (List Changes by SOP)
CREATE INDEX IF NOT EXISTS idx_tickets_change_sop
    ON tickets (change_sop_id) WHERE change_sop_id IS NOT NULL;

-- 复合索引: 按 tenant + 模板过滤 (多租户场景下的高频查询)
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_change
    ON tickets (tenant_id, change_template_id) WHERE change_template_id IS NOT NULL;

COMMENT ON COLUMN tickets.change_template_id IS
    '关联 change_templates.id; NULL 表示非变更类型工单; '
    'ADR-015 方案 A 第 1 层引用';

COMMENT ON COLUMN tickets.change_sop_id IS
    '关联 change_sops.id; NULL 表示非变更类型工单; '
    'ADR-015 方案 A 第 2 层引用; 无外键约束以容忍历史数据';

COMMIT;
