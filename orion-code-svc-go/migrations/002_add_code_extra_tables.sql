-- Code branches table (cached branches from Git provider)
CREATE TABLE IF NOT EXISTS code_branches (
    id UUID PRIMARY KEY,
    repo_id VARCHAR(256) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    commit_sha VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(repo_id, name)
);
CREATE INDEX IF NOT EXISTS idx_code_branches_repo ON code_branches(repo_id, tenant_id);

-- Code commits table (git commit history)
CREATE TABLE IF NOT EXISTS code_commits (
    id UUID PRIMARY KEY,
    repo_id VARCHAR(256) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    sha VARCHAR(64) NOT NULL,
    message TEXT,
    author_name VARCHAR(256),
    author_email VARCHAR(256),
    committed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(repo_id, sha)
);
CREATE INDEX IF NOT EXISTS idx_code_commits_repo ON code_commits(repo_id, tenant_id, committed_at DESC);

-- Code pull requests table
CREATE TABLE IF NOT EXISTS code_pull_requests (
    id UUID PRIMARY KEY,
    repo_id VARCHAR(256) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    number INT NOT NULL,
    title VARCHAR(512) NOT NULL,
    description TEXT,
    source_branch VARCHAR(256),
    target_branch VARCHAR(256),
    state VARCHAR(32) NOT NULL DEFAULT 'open',
    author VARCHAR(256),
    commit_sha VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(repo_id, number)
);
CREATE INDEX IF NOT EXISTS idx_code_prs_repo ON code_pull_requests(repo_id, tenant_id, state);

-- Code reviews table
CREATE TABLE IF NOT EXISTS code_reviews (
    id UUID PRIMARY KEY,
    pr_id VARCHAR(256) NOT NULL,
    repo_id VARCHAR(256) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    reviewer VARCHAR(256) NOT NULL,
    state VARCHAR(32) NOT NULL DEFAULT 'pending',
    content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_code_reviews_pr ON code_reviews(pr_id, tenant_id);

-- Code builds table
CREATE TABLE IF NOT EXISTS code_builds (
    id UUID PRIMARY KEY,
    repo_id VARCHAR(256) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    commit_sha VARCHAR(64),
    branch VARCHAR(256),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    triggered_by VARCHAR(256),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_code_builds_repo ON code_builds(repo_id, tenant_id, created_at DESC);