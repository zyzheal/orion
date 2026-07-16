-- ChatOps Webhook Tables

CREATE TABLE IF NOT EXISTS chatops_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    events JSONB NOT NULL DEFAULT '[]',
    secret_key VARCHAR(255),
    enabled BOOLEAN DEFAULT true,
    retry_count INT DEFAULT 3,
    retry_interval_seconds INT DEFAULT 30,
    timeout_seconds INT DEFAULT 10,
    headers JSONB DEFAULT '{}',
    description TEXT,
    created_by VARCHAR(100),
    last_triggered_at TIMESTAMP,
    last_status VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Webhook 执行日志
CREATE TABLE IF NOT EXISTS chatops_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES chatops_webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB,
    response_status INT,
    response_body TEXT,
    error_message TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
