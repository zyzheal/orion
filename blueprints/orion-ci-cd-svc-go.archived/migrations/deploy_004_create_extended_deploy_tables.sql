-- Create deploy_windows table for scheduled deployment windows
CREATE TABLE IF NOT EXISTS deploy_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    environment_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    duration_minutes INT DEFAULT 60,
    timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',
    status VARCHAR(50) DEFAULT 'active',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deploy_windows_tenant_id ON deploy_windows (tenant_id);
CREATE INDEX IF NOT EXISTS idx_deploy_windows_environment_id ON deploy_windows (environment_id);
CREATE INDEX IF NOT EXISTS idx_deploy_windows_status ON deploy_windows (status);

-- Create deploy_progressive_stages table for multi-stage deployments
CREATE TABLE IF NOT EXISTS deploy_progressive_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    stage_name VARCHAR(255) NOT NULL,
    stage_order INT NOT NULL,
    traffic_percent INT NOT NULL DEFAULT 0,
    instance_count INT DEFAULT 1,
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    validation_result JSONB DEFAULT '{}',
    auto_promote BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progressive_stages_deployment_id ON deploy_progressive_stages (deployment_id);
CREATE INDEX IF NOT EXISTS idx_progressive_stages_status ON deploy_progressive_stages (status);
CREATE INDEX IF NOT EXISTS idx_progressive_stages_tenant_id ON deploy_progressive_stages (tenant_id);

-- Create deploy_emergencies table for emergency deployment requests
CREATE TABLE IF NOT EXISTS deploy_emergencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    requested_by VARCHAR(255) NOT NULL,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    post_mortem TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deploy_emergencies_tenant_id ON deploy_emergencies (tenant_id);
CREATE INDEX IF NOT EXISTS idx_deploy_emergencies_status ON deploy_emergencies (status);

-- Create deployment_release_notes table for release notes
CREATE TABLE IF NOT EXISTS deployment_release_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    version VARCHAR(100) NOT NULL DEFAULT '1.0.0',
    environment VARCHAR(100) NOT NULL,
    generated_at TIMESTAMP DEFAULT NOW(),
    summary TEXT,
    changes JSONB DEFAULT '[]',
    metrics JSONB DEFAULT '{}',
    notes TEXT,
    content TEXT,
    generated_by VARCHAR(50) DEFAULT 'system',
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_release_notes_deployment_id ON deployment_release_notes (deployment_id);
CREATE INDEX IF NOT EXISTS idx_release_notes_tenant_id ON deployment_release_notes (tenant_id);

-- Create deploy_git_commit_links table for git commit correlation
CREATE TABLE IF NOT EXISTS deploy_git_commit_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    commit_sha VARCHAR(40) NOT NULL,
    commit_message TEXT,
    commit_author VARCHAR(255),
    commit_email VARCHAR(255),
    committed_at TIMESTAMP,
    branch VARCHAR(255),
    pr_number VARCHAR(100),
    pr_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_git_links_deployment_id ON deploy_git_commit_links (deployment_id);
CREATE INDEX IF NOT EXISTS idx_git_links_tenant_id ON deploy_git_commit_links (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_git_links_tenant_deployment ON deploy_git_commit_links (tenant_id, deployment_id);
