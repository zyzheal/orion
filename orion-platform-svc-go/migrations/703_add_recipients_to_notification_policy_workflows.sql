-- 703_add_recipients_to_notification_policy_workflows.sql
--
-- G3: 为 notification_policy_workflows 增加 recipients JSONB 列，
-- 与 G2 escalation_recipients 使用相同的 RecipientSpec 结构。
--
-- 参考：backend-g1-g3-implementation-spec-2026-10-11.md §4

ALTER TABLE notification_policy_workflows
    ADD COLUMN IF NOT EXISTS recipients JSONB DEFAULT NULL;

COMMENT ON COLUMN notification_policy_workflows.recipients IS
    'G3: RecipientSpec JSON (kind: user/role/team/oncall-duty/escalation/broadcast); '
    '若为 NULL 使用旧的 steps 隐式收件人（向后兼容）';

CREATE INDEX IF NOT EXISTS idx_notif_workflow_recipients_kind
    ON notification_policy_workflows ((recipients->>'kind'))
    WHERE recipients IS NOT NULL;
