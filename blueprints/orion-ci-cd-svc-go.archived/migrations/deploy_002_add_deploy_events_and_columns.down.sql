DROP TABLE IF EXISTS deployment_events;
ALTER TABLE deployments DROP COLUMN IF EXISTS strategy;
ALTER TABLE deployments DROP COLUMN IF EXISTS error_message;
ALTER TABLE deployments DROP COLUMN IF EXISTS duration_ms;
ALTER TABLE deployments DROP COLUMN IF EXISTS completed_at;
ALTER TABLE deployments DROP COLUMN IF EXISTS started_at;
