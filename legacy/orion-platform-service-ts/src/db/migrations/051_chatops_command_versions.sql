-- ChatOps Command Version Management Tables

-- 命令版本历史
CREATE TABLE IF NOT EXISTS chatops_command_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_id VARCHAR(100) NOT NULL,
    version INT NOT NULL,
    command_text TEXT NOT NULL,
    parameters JSONB,
    description TEXT,
    changelog TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    is_current BOOLEAN DEFAULT false,
    UNIQUE(command_id, version)
);

-- 命令版本标签
CREATE TABLE IF NOT EXISTS chatops_command_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_version_id UUID NOT NULL REFERENCES chatops_command_versions(id) ON DELETE CASCADE,
    tag_name VARCHAR(50) NOT NULL,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);
