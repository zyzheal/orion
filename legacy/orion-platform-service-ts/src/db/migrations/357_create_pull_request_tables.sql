-- Migration: 357_create_pull_request_tables.sql
-- Purpose: Persist PR/MR event audit logs for GitHub and GitLab integrations

-- PR Check Runs — recorded check status updates posted to PRs
CREATE TABLE IF NOT EXISTS pr_check_runs (
    id              VARCHAR(50) PRIMARY KEY,
    tenant_id       VARCHAR(50) NOT NULL,
    provider        VARCHAR(20) NOT NULL,         -- github, gitlab
    repository      VARCHAR(255) NOT NULL,         -- owner/repo
    pr_number       INTEGER NOT NULL,
    check_context   VARCHAR(200) NOT NULL,
    check_state     VARCHAR(20) NOT NULL,          -- pending, success, failure, error
    description     TEXT,
    target_url      TEXT,
    commit_sha      VARCHAR(64),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcr_tenant ON pr_check_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pcr_repo_pr ON pr_check_runs(repository, pr_number);
CREATE INDEX IF NOT EXISTS idx_pcr_state ON pr_check_runs(check_state);
CREATE INDEX IF NOT EXISTS idx_pcr_created ON pr_check_runs(created_at DESC);

-- PR Comments — recorded comments posted to PRs/MRs
CREATE TABLE IF NOT EXISTS pr_comments (
    id              VARCHAR(50) PRIMARY KEY,
    tenant_id       VARCHAR(50) NOT NULL,
    provider        VARCHAR(20) NOT NULL,
    repository      VARCHAR(255) NOT NULL,
    pr_number       INTEGER NOT NULL,
    comment_body    TEXT NOT NULL,
    comment_type    VARCHAR(50) DEFAULT 'general', -- general, test_results, review
    commit_sha      VARCHAR(64),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pc_tenant ON pr_comments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pc_repo_pr ON pr_comments(repository, pr_number);
CREATE INDEX IF NOT EXISTS idx_pc_type ON pr_comments(comment_type);
CREATE INDEX IF NOT EXISTS idx_pc_created ON pr_comments(created_at DESC);
