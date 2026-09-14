-- Reverse 588. The columns carry no data that would not already be in a plan's
-- per-metric caps, and the service re-derives the missing ones (resolveSoftLimit
-- falls back to hard * 0.8, resolveHardLimit falls back to the per-metric
-- limit), so a plain DROP COLUMN is lossless in the sense that no other column
-- stops making sense.

ALTER TABLE tenant_quota_plan DROP COLUMN IF EXISTS soft_limit;
ALTER TABLE tenant_quota_plan DROP COLUMN IF EXISTS hard_limit;
ALTER TABLE tenant_quota_plan DROP COLUMN IF EXISTS over_limit_action;
ALTER TABLE tenant_quota_plan DROP COLUMN IF EXISTS warn_thresholds;
