-- Migration 777: Add IMMUTABLE trigger to audit_logs table (GATE-AUDIT-IMMUTABLE)
-- 来源: baseline v5.24 GATE-AUDIT-IMMUTABLE 门控 + CC 风险登记册数据治理
-- 目的: 强制 audit_logs 表 append-only 语义 (禁止 UPDATE / DELETE)
-- 兼容性: 现有 audit_logs 表结构不变, 仅添加 trigger
-- 编号: 777 (数据治理批次, 独立于 U14 风险审计表)
-- 回滚: 777_add_audit_immutability_trigger_down.sql
--
-- 用途:
--   GATE-AUDIT-IMMUTABLE (BLOCK): 检测 IMMUTABLE trigger 是否存在
--   CC 数据治理 R-P0: 审计不可篡改 (AWS WA Security Pillar SEC01-BP02)
--
-- 设计原则:
--   1. BEFORE UPDATE / DELETE 阻止修改
--   2. 保留 hash chain (prev_hash + hash) 作为二次防篡改
--   3. 触发错误返回明确 message 便于运维排查

BEGIN;

-- 触发器函数: 阻止 audit_logs 表的 UPDATE / DELETE
CREATE OR REPLACE FUNCTION audit_logs_immutability_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE EXCEPTION
        'audit_logs is immutable: % operations are forbidden (id=%, tenant_id=%, action=%, created_at=%). Use soft-delete pattern (deleted_at) if archival is needed.',
        TG_OP, NEW.id, NEW.tenant_id, NEW.action, NEW.created_at;
    RETURN NULL;
END;
$$;

-- BEFORE UPDATE trigger (single-line for audit-immutable-check.sh regex match)
CREATE TRIGGER trg_audit_logs_no_update BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_immutability_guard();

-- BEFORE DELETE trigger (single-line for audit-immutable-check.sh regex match)
CREATE TRIGGER trg_audit_logs_no_delete BEFORE DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_immutability_guard();

-- 记录 trigger 创建时间戳 (便于运维追踪)
COMMENT ON FUNCTION audit_logs_immutability_guard() IS
    'GATE-AUDIT-IMMUTABLE: blocks UPDATE/DELETE on audit_logs. Enforcement: plpgsql RAISE EXCEPTION. Rollback: DROP TRIGGER in 777_add_audit_immutability_trigger_down.sql.';

COMMENT ON TRIGGER trg_audit_logs_no_update ON audit_logs IS
    'Prevents UPDATE on audit_logs rows (append-only audit trail).';

COMMENT ON TRIGGER trg_audit_logs_no_delete ON audit_logs IS
    'Prevents DELETE on audit_logs rows (append-only audit trail).';

COMMIT;
