-- Migration 074: Consistency Monitor Tables
-- Tracks data consistency checks between Pipeline and Artifact systems

-- Consistency checks table
CREATE TABLE IF NOT EXISTS consistency_checks (
    id SERIAL PRIMARY KEY,
    check_type VARCHAR(32) NOT NULL,
    resource_type VARCHAR(32) NOT NULL,
    resource_id VARCHAR(64) NOT NULL,
    expected_hash VARCHAR(128),
    actual_hash VARCHAR(128),
    is_consistent BOOLEAN NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_action VARCHAR(64),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_consistency_checks_type ON consistency_checks(check_type);
CREATE INDEX idx_consistency_checks_resource ON consistency_checks(resource_type, resource_id);
CREATE INDEX idx_consistency_checks_status ON consistency_checks(is_consistent);
CREATE INDEX idx_consistency_checks_detected ON consistency_checks(detected_at);
CREATE INDEX idx_consistency_checks_resolved ON consistency_checks(resolved_at) WHERE resolved_at IS NOT NULL;

COMMENT ON TABLE consistency_checks IS 'Data consistency check records for Pipeline-Artifact integrity';
COMMENT ON COLUMN consistency_checks.check_type IS 'Type of consistency check: pipeline_artifact, config_sync, deployment_state';
COMMENT ON COLUMN consistency_checks.resource_type IS 'Resource type: pipeline, artifact, deployment, config';
COMMENT ON COLUMN consistency_checks.resource_id IS 'Unique identifier for the resource being checked';
COMMENT ON COLUMN consistency_checks.expected_hash IS 'Expected SHA-256 hash of the resource content';
COMMENT ON COLUMN consistency_checks.actual_hash IS 'Actual SHA-256 hash computed during check';
COMMENT ON COLUMN consistency_checks.is_consistent IS 'Whether the resource passed consistency check';
COMMENT ON COLUMN consistency_checks.detected_at IS 'Timestamp when check was performed';
COMMENT ON COLUMN consistency_checks.resolved_at IS 'Timestamp when inconsistency was resolved';
COMMENT ON COLUMN consistency_checks.resolution_action IS 'Action taken to resolve: auto_repair, manual_fix, ignored';
COMMENT ON COLUMN consistency_checks.metadata IS 'Additional context: error details, repair logs';

-- Rollback:
-- DROP TABLE IF EXISTS consistency_checks;