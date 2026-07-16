-- Active Sessions table (Task 4.54)
-- Tracks user login sessions for single sign-out and session management
-- Referenced by UserStatusService.ts disableUser() cleanup

CREATE TABLE IF NOT EXISTS active_sessions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    user_id UUID NOT NULL,
    session_token VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'active',  -- active | revoked | expired
    created_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,

    -- One active session per (user, session_token)
    CONSTRAINT unique_user_session UNIQUE (tenant_id, user_id, session_token)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_active_sessions_tenant ON active_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_active_sessions_status ON active_sessions(status);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions(expires_at);

-- Composite index for session lookup (tenant + user + status)
CREATE INDEX IF NOT EXISTS idx_active_sessions_tenant_user_status
  ON active_sessions(tenant_id, user_id, status);

-- Row Level Security
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_active_sessions ON active_sessions
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );
