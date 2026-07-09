CREATE TABLE IF NOT EXISTS do_not_disturb (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_do_not_disturb_user_tenant
    ON do_not_disturb (user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_do_not_disturb_tenant
    ON do_not_disturb (tenant_id);
CREATE INDEX IF NOT EXISTS idx_do_not_disturb_active
    ON do_not_disturb (tenant_id, start_time, end_time);
