-- ============================================================
-- Migration 769 (down) — NEW-EA-14 cmdb 4 个 K8s/Script 桩升级
-- ============================================================
-- 顺序：先 DROP INDEX，再 DROP TABLE（PG 惯例）。
-- 注意：down 是破坏性操作，会丢失 script_whitelist + k8s_clusters 数据。
-- 回滚前请确保：
--   1. 已 dump script_whitelist 表备份（如需要恢复）
--   2. 已通知 cmdb K8s 同步使用者（数据丢失后需重新 StartK8sSync）
-- ============================================================

BEGIN;

DROP INDEX IF EXISTS idx_k8s_clusters_status;
DROP INDEX IF EXISTS idx_k8s_clusters_tenant;
DROP TABLE IF EXISTS k8s_clusters;

DROP INDEX IF EXISTS idx_script_whitelist_type;
DROP INDEX IF EXISTS idx_script_whitelist_tenant;
DROP TABLE IF EXISTS script_whitelist;

COMMIT;
