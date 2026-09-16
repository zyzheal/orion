-- 618_create_ai_agent_run_missing_tables.sql
-- ai-agent-run 模块: agent_approvals 表无 CREATE TABLE。
-- 回滚见 618_create_ai_agent_run_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS agent_approvals (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id           UUID NOT NULL,
    agent_id         TEXT NOT NULL DEFAULT '',
    action           TEXT NOT NULL,
    action_input     JSONB DEFAULT '{}',
    reason           TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'pending',
    approved_by      UUID,
    approved_at      TIMESTAMPTZ,
    rejection_reason TEXT NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_approvals_run ON agent_approvals(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_approvals_agent ON agent_approvals(agent_id);
