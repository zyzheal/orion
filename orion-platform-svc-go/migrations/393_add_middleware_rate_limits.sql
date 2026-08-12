-- Migration 393: Add rate_limits column to middleware_configs
-- Persists per-tenant rate limit configuration (previously dropped via _ = cfgJSON)

ALTER TABLE middleware_configs ADD COLUMN IF NOT EXISTS rate_limits JSONB DEFAULT '{}'::jsonb;