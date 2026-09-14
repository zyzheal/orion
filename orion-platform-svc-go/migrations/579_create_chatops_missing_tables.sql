-- ChatOps persistence gaps
--
-- Six tables are referenced by internal/chatops/repository/repository.go but
-- were never created anywhere in the migrations the runner actually applies.
-- cmd/server points database.RunMigrations at "migrations", and
-- database.LoadMigrations skips directories and only accepts three-digit
-- versions, so migrations/notification/009_create_chatops_business_tables.sql
-- (which does define chatops_webhook_logs, in a different shape and with a
-- VARCHAR tenant_id) is never loaded. Nothing greps the six relations:
--     chatops_approvers
--     chatops_approver_schedule
--     chatops_command_version_tags
--     chatops_global_approval_config
--     chatops_knowledge_recommendations
--     chatops_webhook_logs
-- so the repository read and wrote relations that do not exist and the driver
-- failed on every call. That made these live routes permanently unreachable:
--     GET  /api/v1/chatops/admin/approvers                  -> 500
--     GET  /api/v1/chatops/admin/approvers/schedule         -> 500
--     PUT  /api/v1/chatops/admin/approvers/schedule         -> 500
--     GET  /api/v1/chatops/knowledge                        -> 500
--     GET  /api/v1/chatops/admin/webhooks/:id/logs          -> 500
--     POST /api/v1/chatops/admin/webhooks/:id/test          -> 500 (no log write)
--     POST /api/v1/chatops/admin/command-versions/:id/tags  -> 500
--     DELETE /api/v1/chatops/admin/command-versions/:id/tags/:tag -> 500
--     GET/PUT /api/v1/chatops/admin/approval/global         -> 500
--
-- The seventh gap was a name, not a missing table: 020 created
-- chatops_permission_roles with exactly the five columns the repository binds,
-- but the code pointed at chatops_roles, which no migration creates. That split
-- the role data across two relations, so the whole role CRUD answered 500 while
-- the real table stayed empty. 579 does not create chatops_roles - it leaves the
-- relation 020 owns in place, and repository.go now writes to it.
--
-- The shapes follow the columns the repository actually binds:
--   GetApprovers              -> chatops_approvers (user_id, enabled)
--   UpdateApproverSchedule    -> chatops_approver_schedule
--                                (id, tenant_id, user_id, start_time, end_time)
--   AddTag / RemoveTag        -> chatops_command_version_tags
--                                (id, tenant_id, version_id, tag_name, created_by,
--                                 created_at)
--   UpsertGlobalApprovalConfig-> chatops_global_approval_config
--                                (id, tenant_id, enabled, mode)
--                                ON CONFLICT (tenant_id)
--   GetKnowledgeRecommendations-> chatops_knowledge_recommendations
--                                (id, title, context, description)
--   InsertWebhookLog          -> chatops_webhook_logs
--                                (id, tenant_id, webhook_id, status, response_body,
--                                 error, duration_ms, created_at)
--
-- start_time and end_time are VARCHAR(50) rather than TIMESTAMPTZ because
-- ApproverSchedule holds them as strings - 020 chose the same for
-- chatops_dnd_settings.start_time - and sqlx in safe mode cannot scan a
-- TIMESTAMPTZ into a string column.
--
-- version_id and created_by are VARCHAR(255) to match chatops_command_versions,
-- where 020 declared command_id VARCHAR(255) NOT NULL and created_by
-- VARCHAR(255) NOT NULL.
--
-- tenant_id is UUID to match 020, which created every chatops table with
-- tenant_id UUID NOT NULL after 239_unify_tenant_id_to_uuid.sql.

CREATE TABLE IF NOT EXISTS chatops_approvers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chatops_approvers_tenant ON chatops_approvers(tenant_id);

CREATE TABLE IF NOT EXISTS chatops_approver_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    start_time VARCHAR(50),
    end_time VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_chatops_approver_schedule_tenant ON chatops_approver_schedule(tenant_id);

CREATE TABLE IF NOT EXISTS chatops_command_version_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    version_id VARCHAR(255) NOT NULL,
    tag_name VARCHAR(100) NOT NULL,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatops_version_tags_tenant ON chatops_command_version_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chatops_version_tags_version ON chatops_command_version_tags(tenant_id, version_id);

CREATE TABLE IF NOT EXISTS chatops_global_approval_config (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mode VARCHAR(50) NOT NULL DEFAULT 'approval'
);

CREATE TABLE IF NOT EXISTS chatops_knowledge_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    context VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatops_knowledge_tenant ON chatops_knowledge_recommendations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chatops_knowledge_tenant_context ON chatops_knowledge_recommendations(tenant_id, context, created_at DESC);

CREATE TABLE IF NOT EXISTS chatops_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    webhook_id UUID NOT NULL,
    status VARCHAR(50),
    response_body TEXT,
    error TEXT,
    duration_ms BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatops_webhook_logs_tenant ON chatops_webhook_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chatops_webhook_logs_webhook ON chatops_webhook_logs(tenant_id, webhook_id, created_at DESC);
