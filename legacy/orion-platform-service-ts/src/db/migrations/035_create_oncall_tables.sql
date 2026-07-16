-- Migration 035: OnCall Scheduling

CREATE TABLE IF NOT EXISTS oncall_schedules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(200) NOT NULL,
  timezone            VARCHAR(100) NOT NULL,
  rotation_type       VARCHAR(20) NOT NULL,
  rotation_start_hour INT NOT NULL DEFAULT 9,
  team_members        UUID[] NOT NULL DEFAULT '{}',
  start_date          TIMESTAMPTZ NOT NULL DEFAULT now(),
  escalations         JSONB NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_oncall_schedules_name ON oncall_schedules(name);

CREATE TABLE IF NOT EXISTS oncall_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id     UUID NOT NULL REFERENCES oncall_schedules(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_oncall_assignments_schedule ON oncall_assignments(schedule_id);
CREATE INDEX idx_oncall_assignments_time ON oncall_assignments(start_time, end_time);
CREATE INDEX idx_oncall_assignments_user ON oncall_assignments(user_id);

CREATE TABLE IF NOT EXISTS oncall_overrides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id       UUID NOT NULL REFERENCES oncall_schedules(id) ON DELETE CASCADE,
  original_user_id  UUID NOT NULL,
  override_user_id  UUID NOT NULL,
  start_time        TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  reason            TEXT
);
CREATE INDEX idx_oncall_overrides_schedule ON oncall_overrides(schedule_id);
CREATE INDEX idx_oncall_overrides_time ON oncall_overrides(start_time, end_time);

-- Rollback:
-- DROP TABLE IF EXISTS oncall_overrides, oncall_assignments, oncall_schedules;
