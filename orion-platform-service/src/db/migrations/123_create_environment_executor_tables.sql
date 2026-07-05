-- Migration 123: Environment Executor State
-- Creates table for environment hibernation/wake state tracking

CREATE TABLE IF NOT EXISTS environment_executor_states (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env_id                  VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  state                   VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | hibernating | hibernated | waking | error
  last_active_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  hibernated_at           TIMESTAMPTZ,
  wake_scheduled_at       TIMESTAMPTZ,
  ttl_seconds             INT,
  last_checked_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_message          TEXT,
  previous_replicas       INT,
  original_replica_count  INT,
  k8s_namespace           VARCHAR(100),
  k8s_deployment_name     VARCHAR(255),
  k8s_label_selector      VARCHAR(255),
  k8s_scale_stateful_sets BOOLEAN DEFAULT false,
  k8s_hpa_name            VARCHAR(255),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_env_executor_tenant_env ON environment_executor_states(tenant_id, env_id);
CREATE INDEX idx_env_executor_tenant ON environment_executor_states(tenant_id);
CREATE INDEX idx_env_executor_state ON environment_executor_states(state);
