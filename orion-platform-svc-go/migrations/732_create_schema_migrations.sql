-- Migration 732: Create schema_migrations table (ADR-011 §3.2.5)
-- 来源: docs/adr/ADR-011-多租户存储隔离方案.md §3.2.5
-- 目的: 多租户存储隔离 Phase 2 - 跟踪每个 schema 的 migration 版本
-- 兼容性: 新表, 独立于现有 schema_migrations (若有)
-- 编号: 732 (紧邻 730-731)
-- 回滚: 732_create_schema_migrations_down.sql
--
-- 用途 (ADR-011 §3.2.5):
--   - public schema: 全局跑 (现有流程), 记录一行
--   - tenant_xxx schema: 新租户创建时跑 baseline, 记录 schema_name + version
--   - 增量 migration: 所有活跃 schema 都跑, 更新各自 version

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    schema_name TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE schema_migrations IS
    'Migration 版本追踪表 (ADR-011 §3.2.5); 每个 schema 一行, 支持 '
    'public + tenant_xxx 双模式';

COMMENT ON COLUMN schema_migrations.schema_name IS
    'schema 名: public (全局) 或 tenant_xxx (租户专属)';

COMMENT ON COLUMN schema_migrations.version IS
    '该 schema 已应用到的 migration 版本号; 单调递增';

COMMENT ON COLUMN schema_migrations.applied_at IS
    '最近一次 migration 应用时间; 运维审计用';

COMMIT;
