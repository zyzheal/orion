-- Migration 143: Shared Actions Registry
--
-- Reusable CI action definitions that can be referenced across pipelines.
-- Supports local (DB-stored) and remote (URL-referenced) actions.

CREATE TABLE IF NOT EXISTS shared_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL UNIQUE,       -- e.g., "build-go", "deploy-k8s"
  description     TEXT,
  version         VARCHAR(20) NOT NULL DEFAULT 'v1',  -- semantic version
  definition_yaml TEXT NOT NULL,                      -- full YAML definition of the action
  inputs_schema   JSONB,                              -- JSON Schema for action inputs
  tenant_id       UUID,                               -- NULL = public/global
  is_public       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shared_actions_name ON shared_actions(name);
CREATE INDEX idx_shared_actions_tenant ON shared_actions(tenant_id);
CREATE INDEX idx_shared_actions_public ON shared_actions(is_public) WHERE is_public = true;

-- Rollback:
-- DROP TABLE IF EXISTS shared_actions;
