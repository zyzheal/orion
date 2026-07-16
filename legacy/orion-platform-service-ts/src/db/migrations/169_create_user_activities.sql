-- Create user_activities table for operation logging
-- This table tracks user actions for audit and security purposes

CREATE TABLE IF NOT EXISTS user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient user activity queries
CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at DESC);
CREATE INDEX idx_user_activities_action ON user_activities(action);

-- Comments for documentation
COMMENT ON TABLE user_activities IS '用户操作日志表，记录用户在系统中的操作行为';
COMMENT ON COLUMN user_activities.user_id IS '操作用户ID';
COMMENT ON COLUMN user_activities.action IS '操作类型：login/logout/create/update/delete/password_change/token_create/token_delete 等';
COMMENT ON COLUMN user_activities.resource_type IS '资源类型：user/pipeline/artifact 等';
COMMENT ON COLUMN user_activities.resource_id IS '资源ID';
COMMENT ON COLUMN user_activities.details IS '操作详情，JSON格式';
COMMENT ON COLUMN user_activities.ip_address IS '客户端IP地址';
COMMENT ON COLUMN user_activities.user_agent IS '客户端User-Agent';