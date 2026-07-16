-- Migration: 384_create_scm_webhook_tables.sql
-- Purpose: Persist SCM trigger rules to PostgreSQL for cross-restart durability.
--          Webhook events are ephemeral (time-bound, last 100), stored in memory only.
-- F050: SCM webhook persistence for trigger rules

CREATE TABLE IF NOT EXISTS scm_trigger_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id VARCHAR(200) NOT NULL,
  repository_pattern VARCHAR(500) NOT NULL DEFAULT '*',
  branch_pattern VARCHAR(500) NOT NULL DEFAULT '*',
  events TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scm_trigger_rules_pipeline ON scm_trigger_rules(pipeline_id);

COMMENT ON COLUMN scm_trigger_rules.repository_pattern IS 'Exact repo name or glob pattern (e.g., "org/repo", "org/*", "*")';
COMMENT ON COLUMN scm_trigger_rules.branch_pattern IS 'Branch match pattern (e.g., "main", "refs/heads/*", "*")';
COMMENT ON COLUMN scm_trigger_rules.events IS 'Event types that trigger this rule (e.g., push, pull_request)';
