-- Migration: P0-MB multi-branch strategy tables
-- Created: 2026-09-09
--
-- Backs the branch-policy module (internal/branch-policy). Table shapes follow
-- models.go db: tags (source of truth). JSON array columns ([]string) are
-- stored as TEXT. Design doc DDL (multi-branch-strategy-design-v2-impl-2026-09-08.md)
-- is missing build_artifacts.status/deprecated_at/deprecated_reason,
-- sync_run_logs.error_msg and deploy_events.error_msg/created_at — those are
-- added here to match the models.

CREATE TABLE IF NOT EXISTS branch_profiles (
    id               TEXT PRIMARY KEY,
    tenant_id        TEXT NOT NULL,
    repo_id          TEXT NOT NULL,
    name             TEXT NOT NULL,
    semantic         TEXT NOT NULL,            -- main, release, hotfix, lts, customer-custom
    owner_id         TEXT NOT NULL,
    owner_name       TEXT NOT NULL DEFAULT '',
    description      TEXT NOT NULL DEFAULT '',
    lts_until        TIMESTAMPTZ,
    merge_targets    TEXT NOT NULL DEFAULT '[]',   -- JSON []string
    merge_sources    TEXT NOT NULL DEFAULT '[]',   -- JSON []string
    protected_envs   TEXT NOT NULL DEFAULT '[]',   -- JSON []string
    allowed_pipelines TEXT NOT NULL DEFAULT '[]',  -- JSON []string
    status           TEXT NOT NULL DEFAULT 'active', -- active, archived, retired
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_branch_profiles_tenant ON branch_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branch_profiles_repo ON branch_profiles(repo_id);
CREATE INDEX IF NOT EXISTS idx_branch_profiles_semantic ON branch_profiles(semantic);
CREATE INDEX IF NOT EXISTS idx_branch_profiles_status ON branch_profiles(status);

CREATE TABLE IF NOT EXISTS build_artifacts (
    id                 TEXT PRIMARY KEY,
    tenant_id          TEXT NOT NULL,
    branch_profile_id  TEXT NOT NULL,
    branch             TEXT NOT NULL,
    commit_sha         TEXT NOT NULL,
    image_digest       TEXT NOT NULL,          -- sha256:xxx
    image_tag          TEXT NOT NULL,
    image_repo         TEXT NOT NULL,
    build_pipeline_id  TEXT NOT NULL,
    target_envs        TEXT NOT NULL DEFAULT '[]',  -- JSON []string
    signed_by          TEXT NOT NULL DEFAULT '',
    signature_valid    BOOLEAN NOT NULL DEFAULT FALSE,
    binary_checksum    TEXT NOT NULL DEFAULT '',
    config_checksum    TEXT NOT NULL DEFAULT '',
    migration_checksum TEXT NOT NULL DEFAULT '',
    built_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    size_bytes         BIGINT NOT NULL DEFAULT 0,
    status             TEXT NOT NULL DEFAULT 'active', -- active, deprecated
    deprecated_at      TIMESTAMPTZ,
    deprecated_reason  TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_build_artifacts_tenant ON build_artifacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_build_artifacts_branch_profile ON build_artifacts(branch_profile_id);
CREATE INDEX IF NOT EXISTS idx_build_artifacts_branch ON build_artifacts(branch);
CREATE INDEX IF NOT EXISTS idx_build_artifacts_commit ON build_artifacts(commit_sha);
CREATE INDEX IF NOT EXISTS idx_build_artifacts_status ON build_artifacts(status);

CREATE TABLE IF NOT EXISTS namespace_bindings (
    id                TEXT PRIMARY KEY,
    tenant_id         TEXT NOT NULL,
    branch_profile_id TEXT NOT NULL,
    env_name          TEXT NOT NULL,           -- dev, staging, prod
    k8s_namespace     TEXT NOT NULL,
    config_namespace  TEXT NOT NULL DEFAULT '',
    db_name           TEXT NOT NULL DEFAULT '',
    mq_topic_prefix   TEXT NOT NULL DEFAULT '',
    redis_key_prefix  TEXT NOT NULL DEFAULT '',
    image_tag_prefix  TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, branch_profile_id, env_name)
);

CREATE INDEX IF NOT EXISTS idx_ns_bindings_tenant ON namespace_bindings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ns_bindings_branch_profile ON namespace_bindings(branch_profile_id);
CREATE INDEX IF NOT EXISTS idx_ns_bindings_env ON namespace_bindings(env_name);

CREATE TABLE IF NOT EXISTS sync_policies (
    id                     TEXT PRIMARY KEY,
    tenant_id              TEXT NOT NULL,
    name                   TEXT NOT NULL,
    source_branch          TEXT NOT NULL,
    target_branches        TEXT NOT NULL DEFAULT '[]',  -- JSON []string
    frequency              TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, monthly
    cron_expr              TEXT NOT NULL DEFAULT '',
    strategy               TEXT NOT NULL DEFAULT 'merge', -- rebase, cherry-pick, merge
    auto_resolve           TEXT NOT NULL DEFAULT 'none',  -- none, skip-conflict, manual-required
    notify_on_conflict     TEXT NOT NULL DEFAULT '[]',    -- JSON []string
    notify_webhook         TEXT NOT NULL DEFAULT '',
    enabled                BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at            TIMESTAMPTZ,
    last_run_status        TEXT,               -- success, conflict, failed
    last_run_conflict_files TEXT NOT NULL DEFAULT '[]',   -- JSON []string
    change_management_id   TEXT NOT NULL DEFAULT '',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_policies_tenant ON sync_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_policies_enabled ON sync_policies(enabled);
CREATE INDEX IF NOT EXISTS idx_sync_policies_source ON sync_policies(source_branch);

CREATE TABLE IF NOT EXISTS sync_run_logs (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL,
    policy_id       TEXT NOT NULL,
    triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    triggered_by    TEXT NOT NULL DEFAULT 'manual', -- scheduler, manual
    source_commit   TEXT NOT NULL DEFAULT '',
    target_branches TEXT NOT NULL DEFAULT '[]',  -- JSON []string
    status          TEXT NOT NULL DEFAULT 'success', -- success, conflict, failed
    conflict_files  TEXT NOT NULL DEFAULT '[]',  -- JSON []string
    error_msg       TEXT NOT NULL DEFAULT '',
    duration_ms     BIGINT NOT NULL DEFAULT 0,
    change_id       TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_sync_run_logs_tenant ON sync_run_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_run_logs_policy ON sync_run_logs(policy_id);
CREATE INDEX IF NOT EXISTS idx_sync_run_logs_status ON sync_run_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_run_logs_triggered_at ON sync_run_logs(triggered_at);

CREATE TABLE IF NOT EXISTS deploy_events (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    actor_id     TEXT NOT NULL,
    actor_name   TEXT NOT NULL DEFAULT '',
    branch       TEXT NOT NULL,
    env          TEXT NOT NULL,
    from_commit  TEXT NOT NULL DEFAULT '',
    to_commit    TEXT NOT NULL,
    artifact_id  TEXT NOT NULL DEFAULT '',
    image_digest TEXT NOT NULL DEFAULT '',
    approval_id  TEXT NOT NULL DEFAULT '',
    outcome      TEXT NOT NULL DEFAULT 'success', -- success, rolled-back, failed
    rollback_to  TEXT,
    duration_ms  BIGINT NOT NULL DEFAULT 0,
    error_rate   DOUBLE PRECISION NOT NULL DEFAULT 0,
    p99_latency  BIGINT NOT NULL DEFAULT 0,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    gate_result  TEXT NOT NULL DEFAULT '',
    error_msg    TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deploy_events_tenant ON deploy_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deploy_events_branch ON deploy_events(branch);
CREATE INDEX IF NOT EXISTS idx_deploy_events_env ON deploy_events(env);
CREATE INDEX IF NOT EXISTS idx_deploy_events_actor ON deploy_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_deploy_events_outcome ON deploy_events(outcome);
CREATE INDEX IF NOT EXISTS idx_deploy_events_started_at ON deploy_events(started_at);

CREATE TABLE IF NOT EXISTS merge_previews (
    id             TEXT PRIMARY KEY,
    tenant_id      TEXT NOT NULL,
    source_branch  TEXT NOT NULL,
    target_branch  TEXT NOT NULL,
    source_commit  TEXT NOT NULL DEFAULT '',
    target_commit  TEXT NOT NULL DEFAULT '',
    conflict_files TEXT NOT NULL DEFAULT '[]',  -- JSON []string
    added_files    TEXT NOT NULL DEFAULT '[]',  -- JSON []string
    modified_files TEXT NOT NULL DEFAULT '[]',  -- JSON []string
    deleted_files  TEXT NOT NULL DEFAULT '[]',  -- JSON []string
    conflict_count INTEGER NOT NULL DEFAULT 0,
    risk_level     TEXT NOT NULL DEFAULT 'low', -- low, medium, high, critical
    previewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merge_previews_tenant ON merge_previews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_merge_previews_source_target ON merge_previews(source_branch, target_branch);
