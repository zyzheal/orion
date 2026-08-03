-- AI Agent Run 模块表 + 初始数据

CREATE TABLE IF NOT EXISTS agent_runs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    agent_profile_id VARCHAR(36) NOT NULL,
    agent_profile_name VARCHAR(255),
    trigger_payload JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    current_step BIGINT NOT NULL DEFAULT 0,
    total_steps BIGINT NOT NULL DEFAULT 0,
    result JSONB,
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    timeout_at TIMESTAMP WITH TIME ZONE,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint,
    updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM now())::bigint
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_tenant ON agent_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created ON agent_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS agent_decisions (
    id VARCHAR(36) PRIMARY KEY,
    run_id VARCHAR(36) NOT NULL,
    agent_id VARCHAR(255),
    step_number BIGINT NOT NULL,
    action VARCHAR(50) NOT NULL,
    action_input JSONB,
    action_output JSONB,
    reasoning TEXT,
    tool_result JSONB,
    error TEXT,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint
);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_run_id ON agent_decisions(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_created ON agent_decisions(created_at);

-- 初始数据：预置常用 Agent 运行模板
INSERT INTO agent_runs (id, tenant_id, agent_profile_id, agent_profile_name, status, total_steps)
VALUES
    ('demo-run-001', 'tenant-001', 'profile-codereview', 'Code Review Agent', 'pending', 1),
    ('demo-run-002', 'tenant-001', 'profile-deploy', 'Deploy Agent', 'pending', 1)
ON CONFLICT (id) DO NOTHING;
