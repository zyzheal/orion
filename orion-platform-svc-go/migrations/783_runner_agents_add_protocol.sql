-- ============================================================
-- Migration 783 — Runner P0-D1: 多协议类型注册表
-- ============================================================
-- 关联任务：runner P0-D1 (multi-protocol registry)
-- 关联设计：docs/adr/ADR-012-Factory-Handler-注册表模式.md
--
-- 决策：
--   - runner_agents 表新增 protocol 列（VARCHAR(32)，NOT NULL，默认 'http'）
--   - 5 种协议：http / ssh / k8s-exec / winrm / grpc
--   - CHECK 约束硬性限制合法值（数据库层防御，与 CanonicalProtocol 归一化互补）
--   - 默认值 'http' 保证向后兼容：现有行自动落到 http，无需数据回填
--
-- 幂等：
--   - IF NOT EXISTS 让重复执行安全（首次执行添加列，后续执行跳过）
--   - ALTER ... ADD COLUMN IF NOT EXISTS 是 PG 9.6+ 支持
--   - 索引 CONCURRENTLY 需要事务外；此处用普通 CREATE INDEX，事务内即可
--
-- 回滚：783_runner_agents_add_protocol_down.sql
-- ============================================================

BEGIN;

-- 1. 添加 protocol 列（默认 'http' 保证向后兼容）
ALTER TABLE runner_agents
    ADD COLUMN IF NOT EXISTS protocol VARCHAR(32) NOT NULL DEFAULT 'http';

-- 2. CHECK 约束：仅限 5 种合法协议
--    用 DO 块包裹（PG 允许 ALTER ... ADD CONSTRAINT 幂等）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_runner_agents_protocol'
    ) THEN
        ALTER TABLE runner_agents
            ADD CONSTRAINT ck_runner_agents_protocol
            CHECK (protocol IN ('http', 'ssh', 'k8s-exec', 'winrm', 'grpc'));
    END IF;
END $$;

-- 3. 按协议查 agent 的索引（调度器会按协议过滤候选 agent）
CREATE INDEX IF NOT EXISTS idx_runner_agents_protocol
    ON runner_agents (protocol);

COMMENT ON COLUMN runner_agents.protocol IS
    'Runner protocol: http|ssh|k8s-exec|winrm|grpc (P0-D1 multi-protocol registry, default http)';

COMMIT;
