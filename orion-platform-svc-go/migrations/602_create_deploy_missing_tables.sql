-- 602_create_deploy_missing_tables.sql
-- deploy 模块: deployments 表已由 032 创建且列齐，无需 ALTER；
-- 其余 4 张表（rollback_records / audit_logs / release_notes / git_links）无 CREATE TABLE。
-- 回滚见 602_create_deploy_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS rollback_records (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL,
    from_version  TEXT NOT NULL DEFAULT '',
    to_version    TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT '',
    reason        TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rollback_records_deployment ON rollback_records(deployment_id);

CREATE TABLE IF NOT EXISTS deployment_audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL,
    action        TEXT NOT NULL DEFAULT '',
    user_id       TEXT NOT NULL DEFAULT '',
    details       TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deployment_audit_logs_deployment ON deployment_audit_logs(deployment_id);

CREATE TABLE IF NOT EXISTS deployment_release_notes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL,
    content       TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deployment_release_notes_deployment ON deployment_release_notes(deployment_id);

CREATE TABLE IF NOT EXISTS deployment_git_links (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL,
    commit_sha    TEXT NOT NULL DEFAULT '',
    branch        TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deployment_git_links_deployment ON deployment_git_links(deployment_id);

-- deployment_changelog: ListChangelog SELECT 直接引用, 032 未建。
CREATE TABLE IF NOT EXISTS deployment_changelog (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL,
    commit_sha    TEXT NOT NULL DEFAULT '',
    message       TEXT NOT NULL DEFAULT '',
    author        TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deployment_changelog_deployment ON deployment_changelog(deployment_id);
