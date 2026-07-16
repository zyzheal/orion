-- Migration: 179_workflow_performance_indexes
-- Date: 2026-05-20
-- Description: Add composite indexes for workflow cleanup and timeout queries
-- Review findings: S1 - performance optimization

-- ==================== Task Timeout Query Index ====================
-- 优化 findPendingAndAssignedWithOverdueDate 查询
-- 原有索引: idx_wft_status, idx_wft_due_date
-- 新增复合索引覆盖 status + due_date 过滤条件
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wft_status_due_date
ON workflow_tasks(status, due_date)
WHERE status IN ('pending', 'assigned');

-- ==================== Timer Cleanup Query Index ====================
-- 优化 cleanupExpiredTimers 查询
-- 原有索引: idx_wftimer_status
-- 新增复合索引覆盖 status + updated_at 过滤条件
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wftimer_status_updated_at
ON workflow_timers(status, updated_at)
WHERE status IN ('completed', 'cancelled');

-- ==================== Instance Cleanup Query Index ====================
-- 优化 cleanupExpiredInstances 查询
-- 新增复合索引覆盖 status + updated_at 过滤条件
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lwwi_status_updated_at
ON lowcode_workflow_instance(status, updated_at)
WHERE status IN ('completed', 'failed', 'cancelled');

-- ==================== Trigger Log Query Index ====================
-- 优化 findByTriggerId 查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wtl_trigger_status
ON workflow_trigger_logs(trigger_id, status);

-- ==================== Task Assignee Index ====================
-- 优化候选人查询（支持数组包含）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wft_candidate_users
ON workflow_tasks USING GIN (candidate_users);

-- Rollback:
-- DROP INDEX IF EXISTS idx_wft_status_due_date;
-- DROP INDEX IF EXISTS idx_wftimer_status_updated_at;
-- DROP INDEX IF EXISTS idx_lwwi_status_updated_at;
-- DROP INDEX IF EXISTS idx_wtl_trigger_status;
-- DROP INDEX IF EXISTS idx_wft_candidate_users;