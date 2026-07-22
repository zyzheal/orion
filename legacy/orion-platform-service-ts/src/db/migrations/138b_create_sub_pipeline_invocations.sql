-- Migration 138: Sub-Pipeline Invocations
-- Tracks invocations of child pipelines as reusable workflow stages
-- within parent pipeline runs. Enables pipeline composition.

CREATE TABLE IF NOT EXISTS sub_pipeline_invocations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_run_id     UUID NOT NULL,
  child_pipeline_id UUID NOT NULL,
  child_run_id      UUID,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  input_params      JSONB NOT NULL DEFAULT '{}',
  output_results    JSONB NOT NULL DEFAULT '{}',
  stage_name        VARCHAR(200) NOT NULL,
  output_mapping    JSONB NOT NULL DEFAULT '{}',
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

-- Indexes for common query patterns
CREATE INDEX idx_sub_pipeline_invocations_parent_run ON sub_pipeline_invocations(parent_run_id);
CREATE INDEX idx_sub_pipeline_invocations_child_run ON sub_pipeline_invocations(child_run_id);
CREATE INDEX idx_sub_pipeline_invocations_child_pipeline ON sub_pipeline_invocations(child_pipeline_id);
CREATE INDEX idx_sub_pipeline_invocations_status ON sub_pipeline_invocations(status);

-- Rollback:
-- DROP TABLE IF EXISTS sub_pipeline_invocations;
