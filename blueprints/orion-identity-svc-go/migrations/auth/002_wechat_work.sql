-- Migration: Create wechat_work_accounts table for WeChat Work SSO
-- Links WeChat Work identities to Orion users

CREATE TABLE IF NOT EXISTS wechat_work_accounts (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    wechat_userid VARCHAR(128) NOT NULL,
    wechat_openid VARCHAR(128),
    name VARCHAR(128),
    email VARCHAR(256),
    mobile VARCHAR(64),
    department_ids TEXT[],
    position VARCHAR(128),
    avatar TEXT,
    linked BOOLEAN NOT NULL DEFAULT false,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(wechat_userid)
);

CREATE INDEX IF NOT EXISTS idx_wechat_work_user ON wechat_work_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_wechat_work_tenant ON wechat_work_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wechat_work_openid ON wechat_work_accounts(wechat_openid);

-- WeChat Work department group mapping table
CREATE TABLE IF NOT EXISTS wechat_work_departments (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    wechat_dept_id BIGINT NOT NULL,
    wechat_dept_name VARCHAR(256),
    wechat_parent_id BIGINT DEFAULT 0,
    orion_group_id VARCHAR(128),
    orion_group_name VARCHAR(256),
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(wechat_dept_id)
);

CREATE INDEX IF NOT EXISTS idx_wechat_dept_tenant ON wechat_work_departments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wechat_dept_parent ON wechat_work_departments(wechat_parent_id);
