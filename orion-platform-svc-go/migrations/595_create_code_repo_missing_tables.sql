-- 595_create_code_repo_missing_tables.sql
-- code-repo 模块 5 张表无 CREATE TABLE，repository INSERT 全部失败。
-- 注意：code-repo 不用 id/tenant_id，用 adapter_id/repo_id 作为主键。
-- 回滚见 595_create_code_repo_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS code_repo_branches (
    adapter_id  TEXT NOT NULL,
    repo_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    commit_sha  TEXT NOT NULL DEFAULT '',
    "default"   BOOLEAN NOT NULL DEFAULT FALSE,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (adapter_id, repo_id, name)
);
CREATE INDEX IF NOT EXISTS idx_code_repo_branches_repo ON code_repo_branches(adapter_id, repo_id);

CREATE TABLE IF NOT EXISTS code_repo_comments (
    adapter_id TEXT NOT NULL,
    repo_id    TEXT NOT NULL,
    pr_id      BIGINT NOT NULL,
    user_id    TEXT NOT NULL DEFAULT '',
    username   TEXT NOT NULL DEFAULT '',
    body       TEXT NOT NULL DEFAULT '',
    path       TEXT NOT NULL DEFAULT '',
    line       INTEGER,
    commit_sha TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_code_repo_comments_pr ON code_repo_comments(adapter_id, repo_id, pr_id);

CREATE TABLE IF NOT EXISTS code_repo_pull_requests (
    adapter_id    TEXT NOT NULL,
    repo_id       TEXT NOT NULL,
    pr_id         BIGINT NOT NULL,
    title         TEXT NOT NULL DEFAULT '',
    body          TEXT NOT NULL DEFAULT '',
    state         TEXT NOT NULL DEFAULT 'open',
    source_branch TEXT NOT NULL DEFAULT '',
    target_branch TEXT NOT NULL DEFAULT '',
    creator       TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assignees     JSONB DEFAULT '[]',
    PRIMARY KEY (adapter_id, repo_id, pr_id)
);
CREATE INDEX IF NOT EXISTS idx_code_repo_pull_requests_repo ON code_repo_pull_requests(adapter_id, repo_id);

CREATE TABLE IF NOT EXISTS code_repo_reviews (
    adapter_id TEXT NOT NULL,
    repo_id    TEXT NOT NULL,
    pr_id      BIGINT NOT NULL,
    user_id    TEXT NOT NULL DEFAULT '',
    username   TEXT NOT NULL DEFAULT '',
    state      TEXT NOT NULL DEFAULT '',
    body       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_code_repo_reviews_pr ON code_repo_reviews(adapter_id, repo_id, pr_id);

CREATE TABLE IF NOT EXISTS code_repo_webhook_secrets (
    repo_id    TEXT NOT NULL,
    secret     TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_code_repo_webhook_secrets_repo ON code_repo_webhook_secrets(repo_id);
