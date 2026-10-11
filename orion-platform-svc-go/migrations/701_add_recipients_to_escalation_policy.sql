-- 701_add_recipients_to_escalation_policy.sql
--
-- G2: 为 escalation_policy 增加 recipients JSONB 列，用于存储 RecipientSpec。
--
-- 背景：escalation_policy.rules JSON 中隐含了升级路径，
-- 但缺乏结构化的收件人规范（user/role/team/oncall-duty/escalation/broadcast）。
-- 本迁移添加 recipients 列存储标准 RecipientSpec，向后兼容：
-- 若 recipients 为空，仍使用 rules 中的旧字段。
--
-- 参考：backend-g1-g3-implementation-spec-2026-10-11.md §3

ALTER TABLE escalation_policy
    ADD COLUMN IF NOT EXISTS recipients JSONB DEFAULT NULL;

COMMENT ON COLUMN escalation_policy.recipients IS
    'G2: RecipientSpec JSON (kind: user/role/team/oncall-duty/escalation/broadcast); '
    '若为 NULL 表示沿用旧 rules 字段（向后兼容 6 个月）';

-- 用于快速查找使用了 oncall-duty 收件人的升级策略
CREATE INDEX IF NOT EXISTS idx_escalation_policy_recipients_kind
    ON escalation_policy ((recipients->>'kind'))
    WHERE recipients IS NOT NULL;
