-- Scheduled-Notification module tables (auto-generated)

CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body VARCHAR(255) NOT NULL,
    channel VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(255) NOT NULL,
    recipients VARCHAR(255) NOT NULL,
    metadata VARCHAR(255) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    max_retries BIGINT NOT NULL,
    retry_count BIGINT NOT NULL,
    enabled BOOLEAN NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_tenant ON scheduled_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_created ON scheduled_notifications(created_at DESC);

