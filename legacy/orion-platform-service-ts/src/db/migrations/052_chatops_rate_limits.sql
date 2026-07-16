-- ChatOps Rate Limit Tables

CREATE TABLE IF NOT EXISTS chatops_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('user', 'group', 'command')),
    target_id VARCHAR(100),
    command_name VARCHAR(100),
    limit_type VARCHAR(20) NOT NULL CHECK (limit_type IN ('minute', 'hour', 'day')),
    limit_count INT NOT NULL,
    window_seconds INT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 预置默认限流规则
INSERT INTO chatops_rate_limits (target_type, command_name, limit_type, limit_count, window_seconds, description) VALUES
('command', 'deploy', 'minute', 5, 60, 'deploy 命令每分钟最多 5 次'),
('command', 'restart', 'minute', 10, 60, 'restart 命令每分钟最多 10 次'),
('command', 'rollback', 'hour', 3, 3600, 'rollback 命令每小时最多 3 次'),
('user', NULL, 'minute', 30, 60, '每个用户每分钟最多 30 个命令')
ON CONFLICT DO NOTHING;
