-- 051_create_sessions.sql
-- Creates table for user session management with token-based authentication

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

COMMENT ON TABLE sessions IS 'User session management with token-based authentication';
COMMENT ON COLUMN sessions.token IS 'Random hex token for session identification';
COMMENT ON COLUMN sessions.expires_at IS 'Session expiration timestamp';
