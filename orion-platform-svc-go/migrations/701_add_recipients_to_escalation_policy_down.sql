-- 701_add_recipients_to_escalation_policy_down.sql
--
-- 注意：删除列会丢失数据，仅在有测试数据确认无生产使用时执行。

DROP INDEX IF EXISTS idx_escalation_policy_recipients_kind;

ALTER TABLE escalation_policy
    DROP COLUMN IF EXISTS recipients;
