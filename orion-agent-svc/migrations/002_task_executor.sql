-- Migration: 002_task_executor.sql
-- Description: Add task execution logs table for TaskExecutor
-- Created: 2026-05-16

-- Agent Tasks table: stores task executions from TaskExecutor (separate from legacy tasks table)
CREATE TABLE IF NOT EXISTS agent_tasks (
    id VARCHAR(64) PRIMARY KEY,
    agent_id VARCHAR(64) NOT NULL,
    task_type VARCHAR(50) NOT NULL DEFAULT 'command',
    payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    result JSONB,
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Agent Task Logs table: stores execution logs for debugging and auditing
CREATE TABLE IF NOT EXISTS agent_task_logs (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_agent ON agent_tasks(agent_id);
CREATE INDEX idx_agent_tasks_created ON agent_tasks(created_at DESC);
CREATE INDEX idx_agent_task_logs_task ON agent_task_logs(task_id, created_at);

-- Enable RLS
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_logs ENABLE ROW LEVEL SECURITY;

-- Comments for documentation
COMMENT ON TABLE agent_tasks IS 'Task executions from TaskExecutor with sandbox isolation';
COMMENT ON TABLE agent_task_logs IS 'Execution logs for TaskExecutor tasks';