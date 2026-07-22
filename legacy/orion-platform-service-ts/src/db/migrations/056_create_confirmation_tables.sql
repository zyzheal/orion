-- Confirmation Module Migration
-- D7 Fix: Replace in-memory Map storage with PostgreSQL tables
-- Date: 2026-04-28

-- Confirmation requests table
CREATE TABLE IF NOT EXISTS confirmation_requests (
    id VARCHAR(255) PRIMARY KEY,
    scene_type VARCHAR(255) NOT NULL,
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
    ai_suggestion TEXT NOT NULL,
    ai_confidence DECIMAL(5, 4) NOT NULL CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired')),
    push_time TIMESTAMP NOT NULL,
    response_time TIMESTAMP,
    responder VARCHAR(255),
    comment TEXT,
    context JSONB,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Confirmation audit logs table
CREATE TABLE IF NOT EXISTS confirmation_audit_logs (
    id VARCHAR(255) PRIMARY KEY,
    confirmation_id VARCHAR(255) NOT NULL REFERENCES confirmation_requests(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    "user" VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    details TEXT
);

-- Notification settings table
CREATE TABLE IF NOT EXISTS notification_settings (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    channels JSONB NOT NULL DEFAULT '["email", "slack"]',
    dnd_start VARCHAR(10) NOT NULL DEFAULT '22:00',
    dnd_end VARCHAR(10) NOT NULL DEFAULT '08:00',
    auto_approve_p3 BOOLEAN NOT NULL DEFAULT false,
    auto_approve_after_minutes INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_confirmation_scene_type ON confirmation_requests(scene_type);
CREATE INDEX IF NOT EXISTS idx_confirmation_priority ON confirmation_requests(priority);
CREATE INDEX IF NOT EXISTS idx_confirmation_status ON confirmation_requests(status);
CREATE INDEX IF NOT EXISTS idx_confirmation_tenant ON confirmation_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_confirmation_push_time ON confirmation_requests(push_time DESC);

CREATE INDEX IF NOT EXISTS idx_confirmation_audit_conf_id ON confirmation_audit_logs(confirmation_id);
CREATE INDEX IF NOT EXISTS idx_confirmation_audit_user ON confirmation_audit_logs("user");
CREATE INDEX IF NOT EXISTS idx_confirmation_audit_timestamp ON confirmation_audit_logs(timestamp DESC);
