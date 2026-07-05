-- Code repositories table
CREATE TABLE IF NOT EXISTS code_repositories (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    full_name VARCHAR(512),
    repo_url TEXT NOT NULL,
    repo_type VARCHAR(32) NOT NULL DEFAULT 'gitlab',
    default_branch VARCHAR(256) NOT NULL DEFAULT 'main',
    is_private BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    branch VARCHAR(256) NOT NULL DEFAULT 'main',
    commit_hash VARCHAR(64),
    language VARCHAR(32),
    lines_of_code INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_code_repositories_tenant ON code_repositories(tenant_id, created_at);

-- Webhook secrets table
CREATE TABLE IF NOT EXISTS webhook_secrets (
    id UUID PRIMARY KEY,
    repo_id VARCHAR(256) NOT NULL UNIQUE,
    secret VARCHAR(512) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_secrets_repo ON webhook_secrets(repo_id);

-- Webhook event logs table
CREATE TABLE IF NOT EXISTS webhook_event_logs (
    id UUID PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    repo_type VARCHAR(32) NOT NULL,
    repo_name VARCHAR(256) NOT NULL,
    event_id VARCHAR(256),
    success BOOLEAN NOT NULL DEFAULT true,
    error TEXT,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_event_logs_tenant ON webhook_event_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_event_logs_type ON webhook_event_logs(event_type);

-- Branch policies table
CREATE TABLE IF NOT EXISTS branch_policies (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    repo_id VARCHAR(256) NOT NULL,
    branch_pattern VARCHAR(256) NOT NULL,
    prevent_force_push BOOLEAN NOT NULL DEFAULT false,
    prevent_deletion BOOLEAN NOT NULL DEFAULT true,
    merge_strategy VARCHAR(32) NOT NULL DEFAULT 'merge',
    approval_rules JSONB NOT NULL DEFAULT '[]',
    required_checks JSONB NOT NULL DEFAULT '[]',
    require_code_owners BOOLEAN NOT NULL DEFAULT false,
    linear_history BOOLEAN NOT NULL DEFAULT false,
    allow_admin_override BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_branch_policies_repo ON branch_policies(repo_id);
CREATE INDEX IF NOT EXISTS idx_branch_policies_tenant ON branch_policies(tenant_id);

-- Code ownership (CODEOWNERS) table
CREATE TABLE IF NOT EXISTS code_ownership (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    repo_id VARCHAR(256) NOT NULL,
    file_path VARCHAR(512) NOT NULL DEFAULT '.github/CODEOWNERS',
    rules JSONB NOT NULL DEFAULT '[]',
    raw_content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(repo_id)
);
CREATE INDEX IF NOT EXISTS idx_code_ownership_repo ON code_ownership(repo_id);

-- Commit statuses table
CREATE TABLE IF NOT EXISTS commit_statuses (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    repository_id VARCHAR(256) NOT NULL,
    commit_sha VARCHAR(64) NOT NULL,
    state VARCHAR(32) NOT NULL DEFAULT 'pending',
    target_url TEXT,
    description TEXT,
    context VARCHAR(256) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_commit_statuses_sha ON commit_statuses(repository_id, commit_sha);
CREATE INDEX IF NOT EXISTS idx_commit_statuses_tenant ON commit_statuses(tenant_id);
