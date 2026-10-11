-- Migration 705: 补 ticket 的 alert_severity 列，解耦 ticket.type 语义污染
-- 来源：reports/module-upgrade-designs/reference-verification-and-refined-plan-2026-10-11.md §P1-2
-- 目的：tickets.type / category 目前混合承载 (1) 业务分类 (2) 来源渠道 (3) 严重度，
--       通过独立列解耦，避免下游消费者靠字符串匹配做类型判断。
-- 兼容性：新增列 nullable + 默认值，不影响现有查询。
-- 回滚：705_add_ticket_source_and_alert_severity_down.sql

BEGIN;

-- 1. alert_severity 独立列（severity 从 alert 自动带入）
--    tickets.category 保留业务分类语义；alert 来源的工单另存 severity 便于聚合。
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS alert_severity VARCHAR(20) NULL;

-- 从 metadata JSONB 回填（若有 severity 字段）
UPDATE tickets
SET alert_severity = metadata->>'severity'
WHERE metadata IS NOT NULL
  AND metadata->>'severity' IS NOT NULL
  AND alert_severity IS NULL;

-- 部分索引：仅对已填充 alert_severity 的行建索引（工单可能不是全部来自 alert）
CREATE INDEX IF NOT EXISTS idx_tickets_alert_severity
    ON tickets (alert_severity)
    WHERE alert_severity IS NOT NULL;

-- 2. 复合索引：按 tenant + alert_severity 聚合查询（如 "P0 alert 工单多少"）
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_alert_severity
    ON tickets (tenant_id, alert_severity)
    WHERE alert_severity IS NOT NULL;

-- 3. 校验：source 列已在 076 DDL 中就存在，无需 ALTER；
--    仅添加 CHECK 约束防止 source 值越界（可选，宽松）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tickets_source_enum') THEN
        ALTER TABLE tickets ADD CONSTRAINT chk_tickets_source_enum
            CHECK (source IS NULL OR source IN (
                'alert_auto', 'sla_breach', 'manual', 'inspection', 'change',
                'api', 'webhook', 'email', 'chatops', 'other'
            ));
    END IF;
END $$;

COMMENT ON COLUMN tickets.alert_severity IS 'Alert-derived severity (P0/P1/P2/P3/P4)；从 metadata.severity 回填；与 category 语义解耦';

COMMIT;
