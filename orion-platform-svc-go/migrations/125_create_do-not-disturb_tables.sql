-- Do-Not-Disturb module tables (auto-generated)

CREATE TABLE IF NOT EXISTS do_not_disturbs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    start_hour BIGINT NOT NULL,
    end_hour BIGINT NOT NULL,
    timezone VARCHAR(255) NOT NULL,
    weekdays TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_do_not_disturbs_tenant ON do_not_disturbs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_do_not_disturbs_created ON do_not_disturbs(created_at DESC);

