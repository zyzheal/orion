-- Migration 741: TaskRunner Protocol Types — 扩展到 6 种
-- P0-2: 当前 3 种 (shell/docker/sub-pipeline) → +SSH/WinRM/K8s-Exec

CREATE TABLE IF NOT EXISTS task_runner_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    runner_type     TEXT NOT NULL,
    -- Types: shell, docker, sub_pipeline, ssh, winrm, k8s_exec
    display_name    TEXT NOT NULL,
    config_schema   JSONB NOT NULL DEFAULT '{}',
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, runner_type)
);

-- Seed default runner types
INSERT INTO task_runner_types (tenant_id, runner_type, display_name, config_schema, enabled, description) VALUES
    ('default', 'shell', 'Shell Script', '{"command": "", "args": [], "timeout": 300}', TRUE, 'Execute shell commands'),
    ('default', 'docker', 'Docker Container', '{"image": "", "command": "", "volumes": []}', TRUE, 'Run in Docker container'),
    ('default', 'sub_pipeline', 'Sub Pipeline', '{"pipelineId": "", "params": {}}', TRUE, 'Run nested pipeline'),
    ('default', 'ssh', 'SSH Remote', '{"host": "", "port": 22, "user": "", "command": ""}', TRUE, 'Execute on remote host via SSH'),
    ('default', 'winrm', 'WinRM Remote', '{"host": "", "port": 5985, "user": "", "command": ""}', TRUE, 'Execute on Windows via WinRM'),
    ('default', 'k8s_exec', 'K8s Exec', '{"namespace": "", "pod": "", "container": "", "command": ""}', TRUE, 'Execute in K8s pod')
ON CONFLICT DO NOTHING;

CREATE INDEX idx_task_runner_types_tenant ON task_runner_types(tenant_id, enabled);
