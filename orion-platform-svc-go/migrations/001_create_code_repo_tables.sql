-- Code-repo module tables

CREATE TABLE IF NOT EXISTS code_repo_adapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_code_repo_adapters_tenant_id ON code_repo_adapters(tenant_id);

CREATE TABLE IF NOT EXISTS code_repos (
    adapter_id VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL,
    repo_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    url VARCHAR(255),
    is_private BOOLEAN DEFAULT FALSE,
    default_branch VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (adapter_id, repo_id)
);

CREATE INDEX IF NOT EXISTS idx_code_repos_tenant_id ON code_repos(tenant_id);

CREATE TABLE IF NOT EXISTS pull_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    repo_id VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    body TEXT,
    state VARCHAR(20) NOT NULL DEFAULT 'open',
    source_branch VARCHAR(255) NOT NULL,
    target_branch VARCHAR(255) NOT NULL,
    creator VARCHAR(255) NOT NULL,
    assignees JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pull_requests_tenant_id ON pull_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_state ON pull_requests(state);

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    pr_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    state VARCHAR(50) NOT NULL,
    body TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_tenant_id ON reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_pr_id ON reviews(pr_id);

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    pr_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    body TEXT,
    path VARCHAR(255),
    line BIGINT,
    commit_sha VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_tenant_id ON comments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comments_pr_id ON comments(pr_id);

CREATE TABLE IF NOT EXISTS webhooks_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    repo_id VARCHAR(255) NOT NULL,
    secret VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhooks_secrets_tenant_id ON webhooks_secrets(tenant_id);
