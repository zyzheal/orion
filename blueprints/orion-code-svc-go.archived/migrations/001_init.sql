-- 001_init.sql - Code service tables
CREATE TABLE IF NOT EXISTS code_repos (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    provider VARCHAR(100) NOT NULL,
    token TEXT,
    tenant_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS code_repo_branches (
    id BIGSERIAL PRIMARY KEY,
    repo_id BIGINT REFERENCES code_repos(id),
    name VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS code_repo_commits (
    sha VARCHAR(64) NOT NULL,
    message TEXT,
    author VARCHAR(255),
    branch VARCHAR(255),
    repo_id BIGINT REFERENCES code_repos(id),
    authored_at TIMESTAMP,
    PRIMARY KEY (sha, repo_id)
);

CREATE INDEX idx_code_repos_tenant ON code_repos(tenant_id);
CREATE INDEX idx_code_repo_branches_repo ON code_repo_branches(repo_id);
CREATE INDEX idx_code_repo_commits_repo ON code_repo_commits(repo_id);
