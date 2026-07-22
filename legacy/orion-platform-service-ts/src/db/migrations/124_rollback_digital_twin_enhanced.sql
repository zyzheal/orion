-- Rollback Migration 124: Drop digital twin enhanced tables

-- Drop RLS policies first
DROP POLICY IF EXISTS tenant_isolation_twin_configs ON twin_configs;
DROP POLICY IF EXISTS tenant_isolation_traffic_replay_sessions ON traffic_replay_sessions;
DROP POLICY IF EXISTS tenant_isolation_traffic_recording_sessions ON traffic_recording_sessions;
DROP POLICY IF EXISTS tenant_isolation_twin_sandboxes ON twin_sandboxes;

-- Disable RLS
ALTER TABLE twin_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_replay_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_recording_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE twin_sandboxes DISABLE ROW LEVEL SECURITY;

-- Drop indexes in reverse order
DROP INDEX IF EXISTS idx_twin_configs_status;
DROP INDEX IF EXISTS idx_twin_configs_environment;
DROP INDEX IF EXISTS idx_twin_configs_tenant;
DROP INDEX IF EXISTS idx_traffic_replay_sessions_status;
DROP INDEX IF EXISTS idx_traffic_replay_sessions_twin;
DROP INDEX IF EXISTS idx_traffic_replay_sessions_tenant;
DROP INDEX IF EXISTS idx_traffic_recording_sessions_status;
DROP INDEX IF EXISTS idx_traffic_recording_sessions_twin;
DROP INDEX IF EXISTS idx_traffic_recording_sessions_tenant;
DROP INDEX IF EXISTS idx_twin_sandboxes_status;
DROP INDEX IF EXISTS idx_twin_sandboxes_twin;
DROP INDEX IF EXISTS idx_twin_sandboxes_tenant;

-- Drop tables (child tables first due to FK constraints)
DROP TABLE IF EXISTS twin_configs CASCADE;
DROP TABLE IF EXISTS traffic_replay_sessions CASCADE;
DROP TABLE IF EXISTS traffic_recording_sessions CASCADE;
DROP TABLE IF EXISTS twin_sandboxes CASCADE;
