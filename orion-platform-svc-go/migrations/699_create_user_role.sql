-- 699_create_user_role.sql
--
-- G1: user_role 表，用于细粒度角色授权。
-- 与 capability.user_roles (JSON 数组) 共存：本表支持过期时间、
-- 来源追踪、软删除，是 capability 表的能力扩展。
--
-- 设计对齐：
-- - ADR-004 多租户（tenant_id 硬隔离）
-- - ADR-011 DB-per-tenant（本表仍含 tenant_id 列以便混合模式）
-- - 参考 backend-g1-g3-implementation-spec-2026-10-11.md §2
--
-- 迁移策略：
-- - 首次迁移（up）：CREATE TABLE + 索引
-- - 反向迁移（down）：DROP TABLE（若已双写，需先停写）

CREATE TABLE IF NOT EXISTS user_role (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    user_id      UUID NOT NULL,
    role         TEXT NOT NULL,
    -- 来源追踪
    source       TEXT NOT NULL DEFAULT 'manual',
                 -- 枚举: manual / oncall_scheduling / api / import
    granted_by   UUID,           -- 授权者（可为空表示系统授权）
    granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ,    -- 过期时间（NULL = 永久）
    revoked_at   TIMESTAMPTZ,    -- 撤销时间（NULL = 未撤销）
    -- 状态
    status       TEXT NOT NULL DEFAULT 'active',
                 -- 枚举: active / revoked / expired
    reason       TEXT,           -- 授权原因/备注
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- 一用户一角色一租户只能有一条 active 授权
    CONSTRAINT uq_user_role_active UNIQUE (tenant_id, user_id, role)
);

-- 用于快速查询某租户某用户的所有角色（权限检查热路径）
CREATE INDEX idx_user_role_lookup
    ON user_role (tenant_id, user_id)
    WHERE revoked_at IS NULL;

-- 用于扫描即将过期的授权（触发器或定时任务）
CREATE INDEX idx_user_role_expiring
    ON user_role (expires_at)
    WHERE expires_at IS NOT NULL AND status = 'active';

-- 用于查询某租户下某角色的所有成员
CREATE INDEX idx_user_role_by_role
    ON user_role (tenant_id, role)
    WHERE revoked_at IS NULL;

COMMENT ON TABLE user_role IS
    'G1: 细粒度用户角色授权表（含过期时间、来源追踪、软删除）';

COMMENT ON COLUMN user_role.status IS
    'active: 生效中; revoked: 已撤销（软删）; expired: 已过期（由定时器或懒加载置位）';
