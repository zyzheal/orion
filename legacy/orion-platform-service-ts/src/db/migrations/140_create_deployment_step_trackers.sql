-- Migration 140: Deployment Step Trackers
-- Tracks runtime state of progressive deployment steps per pipeline run.
-- Records current step, weight, health check results, and rollback status.

CREATE TABLE IF NOT EXISTS deployment_step_trackers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL,
  strategy_id   UUID NOT NULL,
  strategy_type VARCHAR(20) NOT NULL,  -- 'canary', 'bluegreen', 'rolling'
  current_step  INTEGER NOT NULL DEFAULT 0,
  total_steps   INTEGER NOT NULL DEFAULT 1,
  current_weight INTEGER NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  rollback_reason TEXT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Health check results within a step tracker
CREATE TABLE IF NOT EXISTS deployment_health_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_tracker_id UUID NOT NULL REFERENCES deployment_step_trackers(id) ON DELETE CASCADE,
  step_index      INTEGER NOT NULL,
  endpoint        VARCHAR(500) NOT NULL,
  status_code     INTEGER,
  response_time   INTEGER,  -- milliseconds
  healthy         BOOLEAN NOT NULL,
  error_message   TEXT,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_step_trackers_run ON deployment_step_trackers(run_id);
CREATE INDEX idx_step_trackers_strategy ON deployment_step_trackers(strategy_id);
CREATE INDEX idx_step_trackers_status ON deployment_step_trackers(status);
CREATE INDEX idx_health_checks_tracker ON deployment_health_checks(step_tracker_id);
CREATE INDEX idx_health_checks_healthy ON deployment_health_checks(step_tracker_id, healthy);

-- Rollback:
-- DROP INDEX IF EXISTS idx_health_checks_healthy;
-- DROP INDEX IF EXISTS idx_health_checks_tracker;
-- DROP INDEX IF EXISTS idx_step_trackers_status;
-- DROP INDEX IF EXISTS idx_step_trackers_strategy;
-- DROP INDEX IF EXISTS idx_step_trackers_run;
-- DROP TABLE IF EXISTS deployment_health_checks;
-- DROP TABLE IF EXISTS deployment_step_trackers;
