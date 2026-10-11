-- Migration 720: Add isolation_mode/schema_name/schema_created_at to tenants (ADR-011 §3.2.1)
-- 来源: docs/adr/ADR-011-多租户存储隔离方案.md §3.2.1
-- 目的: 多租户存储隔离 Phase 1 - 允许按套餐/合规/手动指定选择隔离模式
-- 兼容性: 3 列均 nullable OR NOT NULL DEFAULT 'shared'
--   - isolation_mode NOT NULL DEFAULT 'shared': 老租户保持共享库模式
--   - schema_name nullable: shared 模式下为 NULL, schema 模式下指向 schema 名
--   - schema_created_at nullable: schema 创建时间, shared 模式下为 NULL
--   - CHECK 约束保证 isolation_mode 只接受 'shared' 或 'schema'
-- 编号: 720 (ADR-011 明确指定; 独立号段)
-- 回滚: 720_tenants_add_isolation_mode_down.sql

BEGIN;

-- 1. isolation_mode: 隔离模式 ('shared' | 'schema'), 老租户默认 'shared'
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS isolation_mode TEXT NOT NULL DEFAULT 'shared';

-- 2. CHECK 约束: 只允许 'shared' 或 'schema'
--    用 DO 块包一层防重复 (CHECK 约束本身用 IF NOT EXISTS 语法不标准)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_tenants_isolation_mode'
          AND contype = 'c'
          AND conrelid = 'tenants'::regclass
    ) THEN
        ALTER TABLE tenants ADD CONSTRAINT chk_tenants_isolation_mode
            CHECK (isolation_mode IN ('shared', 'schema'));
    END IF;
END $$;

-- 3. schema_name: schema 模式下指向独立 schema 名 (shared 模式为 NULL)
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS schema_name TEXT;

-- 4. schema_created_at: schema 创建时间 (shared 模式为 NULL)
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS schema_created_at TIMESTAMPTZ;

-- 5. Index: 按隔离模式分组查询 (运维工具用)
CREATE INDEX IF NOT EXISTS idx_tenants_isolation_mode
    ON tenants (isolation_mode);

COMMENT ON COLUMN tenants.isolation_mode IS
    '多租户隔离模式 (ADR-011 §3.2.1): '
    "'shared' = 共享库 + tenant_id 过滤 (ADR-0004 现状); 'schema' = schema-per-tenant";

COMMENT ON COLUMN tenants.schema_name IS
    'schema 模式下的独立 schema 名 (如 tenant_xxx); shared 模式下为 NULL';

COMMENT ON COLUMN tenants.schema_created_at IS
    'schema 创建时间; shared 模式下为 NULL; 用于租户生命周期审计';

COMMIT;
