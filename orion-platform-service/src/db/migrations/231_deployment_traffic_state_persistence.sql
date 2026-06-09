-- Migration 231: Deployment Traffic State Persistence
-- Stores real-time traffic routing state for deployment strategies

CREATE TABLE IF NOT EXISTS deployment_traffic_state (
  id                  VARCHAR(200) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  app_name            VARCHAR(200) NOT NULL,
  environment         VARCHAR(100) NOT NULL,
  active_percent      NUMERIC(5,2) NOT NULL DEFAULT 100,
  new_percent         NUMERIC(5,2) NOT NULL DEFAULT 0,
  switched            BOOLEAN NOT NULL DEFAULT false,
  strategy            VARCHAR(50),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_traffic_state_tenant ON deployment_traffic_state(tenant_id);
CREATE INDEX IF NOT EXISTS idx_traffic_state_app_env ON deployment_traffic_state(app_name, environment);

-- Rollback:
-- DROP TABLE IF EXISTS deployment_traffic_state;
