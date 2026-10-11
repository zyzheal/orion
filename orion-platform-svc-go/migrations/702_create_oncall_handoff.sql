-- 702_create_oncall_handoff.sql
--
-- G4 Triage: oncall_handoff 表，用于追踪值班交接事件。
-- 触发时机：值班交接 / 请假 / 应急替代
--
-- 参考：triage-api-contract-design-2026-10-11.md §4
-- 参考：backend-g1-g3-implementation-spec-2026-10-11.md §5

CREATE TABLE IF NOT EXISTS oncall_handoff (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    schedule_id     UUID NOT NULL REFERENCES oncall_schedules(id),
    rotation_id     UUID NOT NULL REFERENCES oncall_assignments(id),
    -- 交接双方
    from_user_id    UUID NOT NULL,
    to_user_id      UUID NOT NULL,
    -- 交接时间
    from_at         TIMESTAMPTZ NOT NULL,
    to_at           TIMESTAMPTZ NOT NULL,
    -- 类型
    reason          TEXT,              -- 请假 / 应急 / 交班 / 其他
    -- 关联 triage 事项
    pending_items   JSONB DEFAULT '[]', -- 交接时未处理完的事项快照
    -- 审计
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID
);

CREATE INDEX idx_oncall_handoff_schedule
    ON oncall_handoff (schedule_id);

CREATE INDEX idx_oncall_handoff_from_user
    ON oncall_handoff (tenant_id, from_user_id);

CREATE INDEX idx_oncall_handoff_to_user
    ON oncall_handoff (tenant_id, to_user_id);

CREATE INDEX idx_oncall_handoff_time_range
    ON oncall_handoff (from_at, to_at);

COMMENT ON TABLE oncall_handoff IS
    'G4 Triage: 值班交接事件记录';

COMMENT ON COLUMN oncall_handoff.pending_items IS
    '交接时未处理完的事项快照，便于新值班人快速了解上下文';
