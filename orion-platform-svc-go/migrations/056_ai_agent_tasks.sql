-- Migration #056: Create ai_agent_tasks table
-- AI Python Phase 1.3: Track AI agent task execution and results

CREATE TABLE IF NOT EXISTS ai_agent_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    agent_name VARCHAR(255) NOT NULL,
    task_type VARCHAR(64) NOT NULL,        -- inference, generation, analysis, decision, review
    status VARCHAR(32) NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, timeout
    input JSONB DEFAULT '{}',
    output JSONB DEFAULT '{}',
    error_message TEXT DEFAULT '',
    duration_ms INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    trace_id VARCHAR(255) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_tenant ON ai_agent_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_agent ON ai_agent_tasks(agent_name);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_type ON ai_agent_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_status ON ai_agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_trace ON ai_agent_tasks(trace_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_created ON ai_agent_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_tenant_status ON ai_agent_tasks(tenant_id, status);