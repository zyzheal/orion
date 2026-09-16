-- Reverse 393_add_middleware_rate_limits.sql.
-- Drop the rate_limits column from middleware_configs.

ALTER TABLE middleware_configs DROP COLUMN IF EXISTS rate_limits;
