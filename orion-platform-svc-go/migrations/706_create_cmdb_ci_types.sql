-- Migration 706: Create cmdb_ci_types table (ADR-013 §3.2.1)
-- 来源: docs/adr/ADR-013-CMDB-二阶模型决策.md §3.2.1
-- 目的: CMDB 二阶模型 Phase 1 - 建立 CI 类型基表
-- 兼容性: 新表，不影响现有 cmdb_cis（type_id 可 NULL）
-- 编号: 706 (与 ADR-013 初稿的 700/701/702 编号冲突, 见 Migration 700-705)
-- 回滚: 706_create_cmdb_ci_types_down.sql

BEGIN;

CREATE TABLE IF NOT EXISTS cmdb_ci_types (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    attributes  JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

-- 按 tenant 快速列出该租户的所有类型
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_types_tenant ON cmdb_ci_types (tenant_id);

-- attributes JSONB 内属性检索（如"查找所有定义了 'cpu' 属性的类型"）
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_types_attributes_gin
    ON cmdb_ci_types USING GIN (attributes);

COMMENT ON TABLE cmdb_ci_types IS
    'CMDB CI Type 二阶模型 (ADR-013 方案 C 渐进式); tenant-scoped 类型定义, 由 ci_type 字符串升级为结构化 attributes JSONB';

COMMENT ON COLUMN cmdb_ci_types.tenant_id IS
    '租户 ID (ADR-0004 共享库 + tenant_id 列过滤)。TEXT 而非 UUID：
    与 ADR-013 §3.2.1 及 Orion 大多数租户列一致；cmdb_cis.tenant_id 是 UUID
    (Mig 609 遗留), 708 backfill 用 tenant_id::TEXT 显式转换, 不做隐式 cast。';

COMMENT ON COLUMN cmdb_ci_types.name IS
    '类型名, tenant 内唯一 (与 cmdb_cis.ci_type 字符串值一致, 供 Migration 708 回填匹配)';

COMMENT ON COLUMN cmdb_ci_types.attributes IS
    'JSONB 数组: [{"name","type","required","default","unit"/"enum"/"format"}...]; 详见 ADR-013 §3.2.2';

COMMIT;
