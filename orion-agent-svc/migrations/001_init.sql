-- Migration: 001_init.sql
-- Description: Initialize agent service tables for agent profiles, runs, and task management
-- Created: 2026-05-15

-- Agent Profiles table: stores configurable agent profiles
CREATE TABLE IF NOT EXISTS agent_profiles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    type VARCHAR(64) NOT NULL DEFAULT 'coder',
    capabilities JSONB NOT NULL DEFAULT '{}',
    config JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    last_active_at TIMESTAMP WITH TIME ZONE,
    tenant_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Agent Runs table: stores execution instances of agent profiles
CREATE TABLE IF NOT EXISTS agent_runs (
    id VARCHAR(64) PRIMARY KEY,
    agent_profile_id VARCHAR(64) NOT NULL,
    agent_profile_name VARCHAR(128),
    trigger_payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    current_step INTEGER NOT NULL DEFAULT 0,
    total_steps INTEGER NOT NULL DEFAULT 1,
    result JSONB,
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    timeout_at TIMESTAMP WITH TIME ZONE NOT NULL,
    tenant_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_agent_profile FOREIGN KEY (agent_profile_id) REFERENCES agent_profiles(id) ON DELETE CASCADE
);

-- Agent Decisions table: stores decision logs for agent runs
CREATE TABLE IF NOT EXISTS agent_decisions (
    id VARCHAR(64) PRIMARY KEY,
    run_id VARCHAR(64) NOT NULL,
    agent_id VARCHAR(64),
    step_number INTEGER NOT NULL,
    action VARCHAR(64) NOT NULL,
    action_input JSONB NOT NULL DEFAULT '{}',
    action_output JSONB,
    reasoning TEXT,
    tool_result JSONB,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_agent_run FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
);

-- Agents table: stores registered agent instances
CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'registering',
    registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    current_task_id VARCHAR(64),
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    tasks_failed INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    tenant_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tasks table: stores task executions on agents
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(64) PRIMARY KEY,
    agent_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    command TEXT NOT NULL,
    working_directory VARCHAR(512) NOT NULL DEFAULT '/workspace',
    environment JSONB NOT NULL DEFAULT '{}',
    timeout_seconds INTEGER NOT NULL DEFAULT 300,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    exit_code INTEGER,
    stdout TEXT NOT NULL DEFAULT '',
    stderr TEXT NOT NULL DEFAULT '',
    error_message TEXT,
    tenant_id VARCHAR(64),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

-- Indexes for performance optimization
CREATE INDEX idx_agent_profiles_status ON agent_profiles(status);
CREATE INDEX idx_agent_profiles_tenant ON agent_profiles(tenant_id);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);
CREATE INDEX idx_agent_runs_profile ON agent_runs(agent_profile_id);
CREATE INDEX idx_agent_runs_tenant ON agent_runs(tenant_id);
CREATE INDEX idx_agent_decisions_run ON agent_decisions(run_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_tenant ON agents(tenant_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_agent ON tasks(agent_id);
CREATE INDEX idx_tasks_tenant ON tasks(tenant_id);

-- Comments for documentation
COMMENT ON TABLE agent_profiles IS 'Stores configurable agent profiles with capabilities and LLM settings';
COMMENT ON TABLE agent_runs IS 'Stores execution instances of agent profiles with decision history';
COMMENT ON TABLE agent_decisions IS 'Decision logs for agent runs showing reasoning and tool usage';
COMMENT ON TABLE agents IS 'Registered agent instances with heartbeat tracking';
COMMENT ON TABLE tasks IS 'Task executions dispatched to agents with output capture';

-- Enable Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;