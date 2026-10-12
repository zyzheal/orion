-- ============================================================
-- Migration 769 — NEW-EA-14 cmdb 4 个 K8s/Script 桩升级
-- ============================================================
-- 关联文档：docs/cmdb-k8s-script-stub-upgrade-2026-10-11.md
-- 决策：
--   - ExecuteScript 白名单改为 DB 持久化（tenant-scoped）
--   - K8s 集群配置表建立（供 k8s.io/client-go 拉取阶段消费）
--
-- 号段分配来源：reports/upgrade-execution-playbook-2026-10-03.md:3047-3050
-- 回滚：git revert <sha> + migrations/769_cmdb_script_whitelist_and_k8s_clusters_down.sql
--
-- 设计约束：
--   - 所有表带 tenant_id（ADR-011 P1-2 TenantAware 强制）
--   - 使用 TIMESTAMPTZ 而非 TIMESTAMP（避免时区歧义）
--   - JSONB 存储白名单条目（未来扩展 script hash、审批人等）
--   - UNIQUE 约束保证幂等；CREATE INDEX CONCURRENTLY 需要 autocommit 事务外，
--     这里用普通 CREATE INDEX 避免事务锁。
--   - 全部小写表名 + 下划线分隔（PG 惯例，与 cmdb_cis 一致）
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. script_whitelist 表
-- ------------------------------------------------------------
-- 用途：租户维度的 ScriptType 白名单。ExecuteScript 服务调用
--       cmdb.script.Whitelist.Allow 时读取本表；未在此表登记的
--       tenant+scriptType 组合将返回 ErrScriptTypeNotAllowed。
--
-- 字段说明：
--   script_type — 归一化后的类型（bash/python/python2/terraform）
--   script_hash — SHA-256 前 16 字节（可选），当 script_body_hash_mode
--                 启用时用于校验脚本内容未被篡改。当前默认关闭。
--   reason      — 审批理由，写入审计链。
--   approver    — 审批人。空表示由平台管理员批量导入。
--
-- 幂等：INSERT ON CONFLICT DO NOTHING（同一 tenant+script_type 只保留一条）。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS script_whitelist (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64)  NOT NULL,
    script_type  VARCHAR(32)  NOT NULL CHECK (script_type IN ('bash', 'python', 'python2', 'terraform')),
    script_hash  CHAR(32),
    reason       TEXT,
    approver     VARCHAR(128),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, script_type)
);

CREATE INDEX IF NOT EXISTS idx_script_whitelist_tenant ON script_whitelist (tenant_id);
CREATE INDEX IF NOT EXISTS idx_script_whitelist_type ON script_whitelist (script_type);

COMMENT ON TABLE script_whitelist IS
    'Per-tenant allow-list of ScriptTypes for cmdb ExecuteScript (NEW-EA-14)';
COMMENT ON COLUMN script_whitelist.script_hash IS
    'Optional SHA-256 truncated to 16 bytes; enables content-hash mode where a specific script body is required, not just the type';
COMMENT ON COLUMN script_whitelist.approver IS
    'Human or service account that approved this whitelist entry; empty for platform-seeded defaults';

-- ------------------------------------------------------------
-- 2. k8s_clusters 表
-- ------------------------------------------------------------
-- 用途：K8s 集群连接配置（供 k8s.io/client-go 阶段读取）。
--       StartK8sSync 将 ApiServerUrl/Token/CACert 存入本表；
--       k8sSyncState.started 从内存态升级为从本表拉取状态。
--
-- 字段说明：
--   api_server_url      — https://… K8s API 入口
--   token               — Bearer Token；生产应迁至 Vault（本批次预留字段）
--   ca_cert             — PEM 编码 CA 证书；NULL 表示跳过证书校验（开发模式）
--   watch_enabled       — 是否启用 Watch 事件推送
--   reconciliation_ms   — 定时 reconcile 间隔（毫秒），0 表示关闭
--   watch_enabled       — 是否启用 Watch 事件推送
--   sync_status         — inactive / syncing / failed / paused
--
-- 幂等：UNIQUE (tenant_id, cluster_name)，同一租户下集群名唯一。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS k8s_clusters (
    id                 BIGSERIAL PRIMARY KEY,
    tenant_id          VARCHAR(64)  NOT NULL,
    cluster_name       VARCHAR(128) NOT NULL,
    api_server_url     TEXT         NOT NULL,
    token              TEXT,
    ca_cert            TEXT,
    watch_enabled      BOOLEAN      NOT NULL DEFAULT FALSE,
    reconciliation_ms  INTEGER      NOT NULL DEFAULT 0 CHECK (reconciliation_ms >= 0),
    sync_status        VARCHAR(16)  NOT NULL DEFAULT 'inactive'
                              CHECK (sync_status IN ('inactive', 'syncing', 'failed', 'paused')),
    last_sync_at       TIMESTAMPTZ,
    last_error         TEXT,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, cluster_name)
);

CREATE INDEX IF NOT EXISTS idx_k8s_clusters_tenant ON k8s_clusters (tenant_id);
CREATE INDEX IF NOT EXISTS idx_k8s_clusters_status ON k8s_clusters (sync_status);

COMMENT ON TABLE k8s_clusters IS
    'Kubernetes cluster connection configs for cmdb K8s sync (NEW-EA-14, stage 3)';
COMMENT ON COLUMN k8s_clusters.token IS
    'Bearer Token for K8s API; production deployments should use Vault integration instead of plain text storage';
COMMENT ON COLUMN k8s_clusters.ca_cert IS
    'PEM-encoded CA certificate; NULL means insecure-skip-tls-verify (dev only)';
COMMENT ON COLUMN k8s_clusters.reconciliation_ms IS
    'Poll interval for reconciliation loop in milliseconds; 0 disables reconcile';

-- ------------------------------------------------------------
-- 3. 默认租户白名单种子（可选）
-- ------------------------------------------------------------
-- 生产环境应通过审批流程写入；此处仅插入 system tenant 的默认值。
-- 幂等：ON CONFLICT DO NOTHING。
-- ------------------------------------------------------------
INSERT INTO script_whitelist (tenant_id, script_type, reason, approver)
VALUES
    ('system', 'bash', 'platform default for cmdb automation', 'platform'),
    ('system', 'python', 'platform default for cmdb automation', 'platform')
ON CONFLICT (tenant_id, script_type) DO NOTHING;

COMMIT;
