-- Migration 055: ChatOps Phase 1a - Enhanced tables for global ChatOps
-- Extends existing chatops_sessions with TTL columns
-- Adds: messages, notification preferences, DND settings, alert states,
--        TTL policies, idempotency keys, and associated indexes

-- ============================================
-- 1. Extend existing chatops_sessions table
-- ============================================
-- Add TTL and audit columns. Existing PK (key VARCHAR) remains unchanged.
-- chatops_messages will reference key via session_key for data consistency.
ALTER TABLE chatops_sessions
  ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
-- Note: created_at already has a default from implicit behavior; ensure it exists.
ALTER TABLE chatops_sessions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ============================================
-- 2. ChatOps Messages (conversation history)
-- ============================================
CREATE TABLE IF NOT EXISTS chatops_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key     VARCHAR(255) NOT NULL REFERENCES chatops_sessions(key) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  content_encrypted TEXT,            -- pgcrypto encrypted (Phase 2)
  parsed_command  JSONB,
  parsed_command_sanitized BOOLEAN DEFAULT true,  -- SE-1: tracks whether params are sanitized
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_chatops_messages_session ON chatops_messages(session_key);
CREATE INDEX idx_chatops_messages_created ON chatops_messages(created_at);
COMMENT ON TABLE chatops_messages IS 'ChatOps conversation message history';

-- ============================================
-- 3. Notification Preferences
-- ============================================
CREATE TABLE IF NOT EXISTS chatops_notification_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR(255) NOT NULL,
  alert_level     VARCHAR(20) NOT NULL CHECK (alert_level IN ('critical', 'warning', 'info')),
  channel_chatops BOOLEAN DEFAULT true,
  channel_email   BOOLEAN DEFAULT false,
  channel_slack   BOOLEAN DEFAULT false,
  channel_feishu  BOOLEAN DEFAULT false,
  channel_dingtalk BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, alert_level)
);
CREATE INDEX idx_chatops_notif_pref_user ON chatops_notification_preferences(user_id, alert_level);
COMMENT ON TABLE chatops_notification_preferences IS 'User notification channel preferences per alert level';

-- ============================================
-- 4. DND (Do Not Disturb) Settings
-- ============================================
CREATE TABLE IF NOT EXISTS chatops_dnd_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR(255) NOT NULL UNIQUE,
  enabled         BOOLEAN DEFAULT false,
  start_time      TIME,
  end_time        TIME,
  repeat_days     INT[] DEFAULT '{1,2,3,4,5}',  -- 1=Mon, 7=Sun
  allow_critical  BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_chatops_dnd_user ON chatops_dnd_settings(user_id);
COMMENT ON TABLE chatops_dnd_settings IS 'User do-not-disturb time windows';

-- ============================================
-- 5. Alert States (read/unread tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS chatops_alert_states (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR(255) NOT NULL,
  alert_id        UUID NOT NULL,
  state           VARCHAR(20) NOT NULL CHECK (state IN ('unread', 'read', 'acknowledged', 'dismissed')),
  read_at         TIMESTAMPTZ,
  dismissed_at    TIMESTAMPTZ,
  escalation_stopped BOOLEAN DEFAULT false,
  escalation_current_level INT DEFAULT 0,
  escalation_last_checked_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, alert_id)
);
CREATE INDEX idx_chatops_alert_states_user ON chatops_alert_states(user_id, state);
COMMENT ON TABLE chatops_alert_states IS 'Alert read/acknowledged/dismissed state per user';

-- ============================================
-- 6. TTL Policies
-- ============================================
CREATE TABLE IF NOT EXISTS chatops_ttl_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_type     VARCHAR(20) NOT NULL CHECK (policy_type IN ('global', 'role', 'project', 'alert_level')),
  policy_key      VARCHAR(255) NOT NULL,
  ttl_days        INT NOT NULL DEFAULT 90,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(policy_type, policy_key)
);
COMMENT ON TABLE chatops_ttl_policies IS 'Configurable TTL days for session/message auto-expiry';

-- ============================================
-- 7. Idempotency Keys (Phase 1a: PostgreSQL backed)
-- ============================================
CREATE TABLE IF NOT EXISTS chatops_idempotency_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             VARCHAR(255) NOT NULL UNIQUE,
  command         VARCHAR(100) NOT NULL,
  user_id         VARCHAR(255) NOT NULL,
  result          JSONB,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | completed | expired
  created_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ DEFAULT (now() + interval '1 hour')
);
CREATE INDEX idx_chatops_idempotency_key ON chatops_idempotency_keys(key);
CREATE INDEX idx_chatops_idempotency_expires ON chatops_idempotency_keys(expires_at);
COMMENT ON TABLE chatops_idempotency_keys IS 'Idempotency keys for POST /execute deduplication';

-- ============================================
-- 8. Seed default TTL policy
-- ============================================
INSERT INTO chatops_ttl_policies (policy_type, policy_key, ttl_days)
VALUES ('global', '*', 90)
ON CONFLICT (policy_type, policy_key) DO NOTHING;

-- ============================================
-- 9. Platform Webhook Configs
-- ============================================
CREATE TABLE IF NOT EXISTS chatops_platform_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR(255) NOT NULL,
  platform        VARCHAR(20) NOT NULL CHECK (platform IN ('dingtalk', 'wecom', 'feishu', 'slack')),
  enabled         BOOLEAN DEFAULT false,
  webhook         TEXT,
  token           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)
);
CREATE INDEX idx_chatops_platform_config_user ON chatops_platform_configs(user_id);
COMMENT ON TABLE chatops_platform_configs IS 'User IM platform webhook configurations';

COMMENT ON TABLE chatops_messages IS 'ChatOps conversation message history';
