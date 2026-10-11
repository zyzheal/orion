-- Migration 704 down: 移除 ticket_subtables 的 tenant_id 列
-- 注意：删除列会丢失数据，仅在紧急回滚时使用。

BEGIN;

-- 删索引
DROP INDEX IF EXISTS idx_ticket_comments_tenant;
DROP INDEX IF EXISTS idx_ticket_transfers_tenant;
DROP INDEX IF EXISTS idx_ticket_assignment_rules_tenant;
DROP INDEX IF EXISTS idx_ticket_suspensions_tenant;

-- 删列
ALTER TABLE ticket_comments DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE ticket_transfers DROP COLUMN IF EXISTS tenant_id;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_assignment_rules') THEN
        ALTER TABLE ticket_assignment_rules DROP COLUMN IF EXISTS tenant_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_suspensions') THEN
        ALTER TABLE ticket_suspensions DROP COLUMN IF EXISTS tenant_id;
    END IF;
END $$;

COMMIT;
