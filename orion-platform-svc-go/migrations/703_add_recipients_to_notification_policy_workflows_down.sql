-- 703_add_recipients_to_notification_policy_workflows_down.sql

DROP INDEX IF EXISTS idx_notif_workflow_recipients_kind;

ALTER TABLE notification_policy_workflows
    DROP COLUMN IF EXISTS recipients;
