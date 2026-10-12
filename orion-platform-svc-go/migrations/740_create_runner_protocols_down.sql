-- Rollback 740
ALTER TABLE runner_agents
    DROP COLUMN IF EXISTS protocol_id;

DROP TABLE IF EXISTS runner_protocols;
