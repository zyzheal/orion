-- Migration 704: 补 ticket_subtables 的 tenant_id 列
-- 来源：reports/module-upgrade-designs/reference-verification-and-refined-plan-2026-10-11.md §P1-1
-- 目的：为 ticket_comments / ticket_transfers 增加 tenant_id 列，
--       实现多租户隔离（ADR-011 §2）。
-- 兼容性：nullable + 默认从 tickets.tenant_id 回填，不影响现有查询。
-- 回滚：704_add_tenant_id_to_ticket_subtables_down.sql

BEGIN;

-- ============================================================
-- 1. ticket_comments 加 tenant_id
-- ============================================================
ALTER TABLE ticket_comments
    ADD COLUMN IF NOT EXISTS tenant_id UUID NULL;

-- 部分索引：仅对已回填的 tenant_id 建索引（避免阻塞大表）
CREATE INDEX IF NOT EXISTS idx_ticket_comments_tenant
    ON ticket_comments (tenant_id)
    WHERE tenant_id IS NOT NULL;

-- 从 tickets 表回填 tenant_id（幂等：仅对未填充的行）
UPDATE ticket_comments c
SET tenant_id = t.tenant_id
FROM tickets t
WHERE c.ticket_id = t.id
  AND c.tenant_id IS NULL;

-- ============================================================
-- 2. ticket_transfers 加 tenant_id
-- ============================================================
ALTER TABLE ticket_transfers
    ADD COLUMN IF NOT EXISTS tenant_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_transfers_tenant
    ON ticket_transfers (tenant_id)
    WHERE tenant_id IS NOT NULL;

UPDATE ticket_transfers tr
SET tenant_id = t.tenant_id
FROM tickets t
WHERE tr.ticket_id = t.id
  AND tr.tenant_id IS NULL;

-- ============================================================
-- 3. ticket_assignment_rules 加 tenant_id
--    （若表存在）
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_assignment_rules') THEN
        ALTER TABLE ticket_assignment_rules
            ADD COLUMN IF NOT EXISTS tenant_id UUID NULL;

        CREATE INDEX IF NOT EXISTS idx_ticket_assignment_rules_tenant
            ON ticket_assignment_rules (tenant_id)
            WHERE tenant_id IS NOT NULL;
    END IF;
END $$;

-- ============================================================
-- 4. ticket_suspensions 加 tenant_id
--    （若表存在）
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_suspensions') THEN
        ALTER TABLE ticket_suspensions
            ADD COLUMN IF NOT EXISTS tenant_id UUID NULL;

        CREATE INDEX IF NOT EXISTS idx_ticket_suspensions_tenant
            ON ticket_suspensions (tenant_id)
            WHERE tenant_id IS NOT NULL;
    END IF;
END $$;

COMMENT ON COLUMN ticket_comments.tenant_id IS 'ADR-011 多租户隔离；由 tickets.tenant_id 回填';
COMMENT ON COLUMN ticket_transfers.tenant_id IS 'ADR-011 多租户隔离；由 tickets.tenant_id 回填';

COMMIT;
