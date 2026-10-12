-- ============================================================
-- Migration 783 (down) — Runner P0-D1 回滚
-- ============================================================
-- 顺序：先 DROP INDEX，再 DROP CONSTRAINT，最后 DROP COLUMN
-- 注意：DROP COLUMN 会丢失所有 protocol 值，回滚到 'http' 单一协议
-- 行为。如果生产环境已有非-http agent（ssh/k8s-exec/winrm/grpc），
-- 回滚后调度器将把这些 agent 视为 http agent 处理，可能 dispatch 失败。
-- ============================================================

BEGIN;

DROP INDEX IF EXISTS idx_runner_agents_protocol;

ALTER TABLE runner_agents
    DROP CONSTRAINT IF EXISTS ck_runner_agents_protocol;

ALTER TABLE runner_agents
    DROP COLUMN IF EXISTS protocol;

COMMIT;
