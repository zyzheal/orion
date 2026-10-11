-- Migration 757: Create change_sop_steps table (ADR-015 §4.1)
-- 来源: docs/adr/ADR-015-Change-建模决策.md §4.1
-- 参考: reports/expert-reviews/neatlogic-change-event-firsthand-2026-10-03.md §2.2 ChangeSopStepVo
-- 目的: ADR-015 方案 A Change 三层 SOP 第 3 层 - 步骤 (Step)
--       每个 step 有 code + name + worker + startTimeWindow + endTimeWindow
-- 兼容性: 新表, FK 引用 change_sops (756)
-- 编号: 757 (ADR-015 §4.1 明确指定)
-- 回滚: 757_create_change_sop_steps_down.sql

BEGIN;

CREATE TABLE IF NOT EXISTS change_sop_steps (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    sop_id            UUID NOT NULL REFERENCES change_sops(id) ON DELETE CASCADE,
    code              VARCHAR(255) NOT NULL,
    name              VARCHAR(255) NOT NULL,
    content           TEXT,
    plan_start_date   DATE,
    start_time_window VARCHAR(100),
    end_time_window   VARCHAR(100),
    worker            VARCHAR(255),
    file_ids          JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    version           INTEGER NOT NULL DEFAULT 1,
    created_by        VARCHAR(255) NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (tenant_id, sop_id, code)
);

-- 按 sop 查关联 steps (Get SOP detail → include steps)
CREATE INDEX IF NOT EXISTS idx_change_sop_steps_sop
    ON change_sop_steps (sop_id);

-- 按 tenant + code 快速查找
CREATE INDEX IF NOT EXISTS idx_change_sop_steps_tenant_code
    ON change_sop_steps (tenant_id, code);

-- 按 sort_order 排序 (SOP step 执行顺序)
CREATE INDEX IF NOT EXISTS idx_change_sop_steps_sort
    ON change_sop_steps (sop_id, sort_order);

COMMENT ON TABLE change_sop_steps IS
    'Change 作业指导书步骤 (ADR-015 方案 A 三层 SOP 第 3 层); '
    '对齐 NeatLogic ChangeSopStepVo';

COMMENT ON COLUMN change_sop_steps.code IS
    '步骤唯一编码 (业务侧标识); 同一 SOP 内 unique (tenant_id, sop_id, code)';

COMMENT ON COLUMN change_sop_steps.plan_start_date IS
    '计划开始日期 (NL planStartDate, 可为空表示立即执行)';

COMMENT ON COLUMN change_sop_steps.start_time_window IS
    '开始时间窗口 (NL startTimeWindow, 字符串存储如 "09:00-10:00")';

COMMENT ON COLUMN change_sop_steps.end_time_window IS
    '结束时间窗口 (NL endTimeWindow, 字符串存储)';

COMMENT ON COLUMN change_sop_steps.worker IS
    '执行者标识 (NL worker, 可为空表示未指派)';

COMMENT ON COLUMN change_sop_steps.file_ids IS
    '关联文件 UUID 数组 (NL fileIdList)';

COMMENT ON COLUMN change_sop_steps.sort_order IS
    '步骤在 SOP 内的展示/执行顺序; 0 表示默认排序';

COMMENT ON COLUMN change_sop_steps.version IS
    '乐观锁版本号 (ADR-010 方案 C 风格)';

COMMIT;
