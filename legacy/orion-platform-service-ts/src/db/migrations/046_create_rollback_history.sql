-- Migration 046: Rollback History

CREATE TABLE IF NOT EXISTS rollback_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id   UUID NOT NULL,
  rollback_type   VARCHAR(20) NOT NULL,
  reason          TEXT,
  triggered_by    UUID,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'running',
  previous_version VARCHAR(100),
  target_version   VARCHAR(100),
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rollback_history_deployment ON rollback_history(deployment_id);
CREATE INDEX idx_rollback_history_status ON rollback_history(status);
CREATE INDEX idx_rollback_history_started ON rollback_history(started_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS rollback_history;