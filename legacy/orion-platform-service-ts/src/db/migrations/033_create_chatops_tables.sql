-- Migration 033: ChatOps (M35)
-- Creates tables for ChatOps commands, executions, sessions, and audit logs

-- ChatOps Command 命令注册表
CREATE TABLE IF NOT EXISTS chatops_commands (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL UNIQUE,
  subcommand      VARCHAR(100) NOT NULL DEFAULT '',
  schema          JSONB NOT NULL DEFAULT '{}',       -- Parameter schema definition
  aliases         VARCHAR(500)[] NOT NULL DEFAULT '{}',
  permission_level VARCHAR(50) NOT NULL DEFAULT 'user', -- user | operator | deployer | admin
  examples        TEXT[] NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_chatops_commands_name ON chatops_commands(name);
CREATE INDEX idx_chatops_commands_permission ON chatops_commands(permission_level);
COMMENT ON TABLE chatops_commands IS 'ChatOps command registry with schema and permission definitions';

-- ChatOps Execution 执行记录表
CREATE TABLE IF NOT EXISTS chatops_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id      VARCHAR(100) NOT NULL,
  user_id         VARCHAR(255) NOT NULL,
  platform        VARCHAR(50) NOT NULL,              -- slack | teams | webhook | cli
  channel         VARCHAR(255) NOT NULL,
  params          JSONB NOT NULL DEFAULT '{}',
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed | cancelled
  start_time      TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time        TIMESTAMPTZ,
  result          JSONB NOT NULL DEFAULT '{}',
  milestones      JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_chatops_executions_command ON chatops_executions(command_id);
CREATE INDEX idx_chatops_executions_user ON chatops_executions(user_id);
CREATE INDEX idx_chatops_executions_status ON chatops_executions(status);
CREATE INDEX idx_chatops_executions_start_time ON chatops_executions(start_time);
COMMENT ON TABLE chatops_executions IS 'ChatOps command execution tracking and results';

-- ChatOps Session 会话状态表
CREATE TABLE IF NOT EXISTS chatops_sessions (
  key             VARCHAR(255) PRIMARY KEY,
  user_id         VARCHAR(255) NOT NULL,
  channel_id      VARCHAR(255) NOT NULL,
  history         JSONB NOT NULL DEFAULT '[]',
  state           JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_chatops_sessions_user ON chatops_sessions(user_id);
COMMENT ON TABLE chatops_sessions IS 'ChatOps interactive session state and conversation history';

-- ChatOps Audit Log 审计日志表
CREATE TABLE IF NOT EXISTS chatops_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id        VARCHAR(100) NOT NULL,
  actor           JSONB NOT NULL,                    -- { userId, platform, ... }
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  action          JSONB NOT NULL,                    -- { command, params, channel, ... }
  result          VARCHAR(50) NOT NULL DEFAULT 'unknown', -- success | failed | cancelled | unknown
  context         JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_chatops_audit_trace ON chatops_audit_logs(trace_id);
CREATE INDEX idx_chatops_audit_timestamp ON chatops_audit_logs(timestamp);
CREATE INDEX idx_chatops_audit_result ON chatops_audit_logs(result);
COMMENT ON TABLE chatops_audit_logs IS 'ChatOps audit trail for compliance and forensics';
