-- Create user_notification_preferences table
-- This table stores user notification settings

CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    email_enabled BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    webhook_enabled BOOLEAN DEFAULT false,
    webhook_url VARCHAR(500),
    notify_frequency VARCHAR(20) DEFAULT 'realtime',
    notify_types JSONB DEFAULT '["pipeline","approval","alert"]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX idx_user_notification_preferences_user_id ON user_notification_preferences(user_id);

-- Comments for documentation
COMMENT ON TABLE user_notification_preferences IS '用户通知偏好设置表';
COMMENT ON COLUMN user_notification_preferences.user_id IS '用户ID';
COMMENT ON COLUMN user_notification_preferences.email_enabled IS '是否启用邮件通知';
COMMENT ON COLUMN user_notification_preferences.in_app_enabled IS '是否启用站内信通知';
COMMENT ON COLUMN user_notification_preferences.webhook_enabled IS '是否启用Webhook推送';
COMMENT ON COLUMN user_notification_preferences.webhook_url IS 'Webhook回调URL';
COMMENT ON COLUMN user_notification_preferences.notify_frequency IS '通知频率：realtime/daily/weekly';
COMMENT ON COLUMN user_notification_preferences.notify_types IS '通知类型列表，JSON数组';