-- Migration 067: Engineer Profiles Table
-- Stores engineer profiles for dispatch, load balancing, and performance tracking.
-- Previously managed via in-memory Maps in DispatchEngine/LoadBalancer.

CREATE TABLE IF NOT EXISTS engineer_profiles (
  id                    UUID PRIMARY KEY,
  name                  VARCHAR(200) NOT NULL,
  expertise             TEXT[] NOT NULL DEFAULT '{}',
  current_load          INT NOT NULL DEFAULT 0,
  max_capacity          INT NOT NULL DEFAULT 10,
  availability          VARCHAR(20) NOT NULL DEFAULT 'available',
  team                  VARCHAR(100),
  on_call               BOOLEAN NOT NULL DEFAULT false,
  skills                JSONB,
  total_resolved        INT NOT NULL DEFAULT 0,
  avg_resolution_time_ms BIGINT NOT NULL DEFAULT 0,
  sla_compliance_rate   DECIMAL(3,2) NOT NULL DEFAULT 0,
  resolution_by_category JSONB NOT NULL DEFAULT '{}',
  resolution_by_priority JSONB NOT NULL DEFAULT '{}',
  escalation_count      INT NOT NULL DEFAULT 0,
  satisfaction_score    DECIMAL(3,2),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_engineer_profiles_availability ON engineer_profiles(availability);
CREATE INDEX idx_engineer_profiles_team ON engineer_profiles(team);

-- Rollback:
-- DROP TABLE IF EXISTS engineer_profiles;
