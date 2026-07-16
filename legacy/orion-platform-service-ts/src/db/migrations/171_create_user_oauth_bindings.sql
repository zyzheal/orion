-- Create user_oauth_bindings table for third-party login
-- This table stores OAuth bindings for users

CREATE TABLE IF NOT EXISTS user_oauth_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Index for efficient queries
CREATE INDEX idx_user_oauth_bindings_user_id ON user_oauth_bindings(user_id);
CREATE INDEX idx_user_oauth_bindings_provider ON user_oauth_bindings(provider);

-- Comments for documentation
COMMENT ON TABLE user_oauth_bindings IS '用户第三方登录绑定表';
COMMENT ON COLUMN user_oauth_bindings.user_id IS '本地用户ID';
COMMENT ON COLUMN user_oauth_bindings.provider IS '第三方提供商：github/gitlab/wechat 等';
COMMENT ON COLUMN user_oauth_bindings.provider_user_id IS '第三方平台的用户ID';
COMMENT ON COLUMN user_oauth_bindings.access_token IS '第三方平台的访问令牌（加密存储）';
COMMENT ON COLUMN user_oauth_bindings.refresh_token IS '第三方平台的刷新令牌（加密存储）';
COMMENT ON COLUMN user_oauth_bindings.expires_at IS '令牌过期时间';