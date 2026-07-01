-- Stage Group abstraction for multi-stage batch execution (Task 5: StageGroupOrchestrator)
-- Extends grayScale from single-stage to stage-group level.
-- Mirrors NeatLogic PhaseGroup with GRAYSCALE policy at group level.

CREATE TABLE IF NOT EXISTS stage_group_definitions (
  id VARCHAR(36) PRIMARY KEY,
  pipeline_id VARCHAR(36) NOT NULL REFERENCES pipelines(id),
  tenant_id VARCHAR(36) NOT NULL,
  group_name VARCHAR(255) NOT NULL,
  stage_names TEXT[] NOT NULL,
  execution_mode VARCHAR(20) NOT NULL DEFAULT 'oneshot',
  batch_size INTEGER NOT NULL DEFAULT 1,
  targets TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255),
  CONSTRAINT unique_group_name_per_pipeline UNIQUE (pipeline_id, group_name)
);

CREATE INDEX IF NOT EXISTS idx_stage_group_definitions_pipeline
  ON stage_group_definitions(pipeline_id);

CREATE TABLE IF NOT EXISTS stage_group_executions (
  id VARCHAR(36) PRIMARY KEY,
  run_id VARCHAR(36) NOT NULL REFERENCES pipeline_runs(id),
  group_id VARCHAR(36) NOT NULL REFERENCES stage_group_definitions(id),
  group_name VARCHAR(255) NOT NULL,
  batch_index INTEGER NOT NULL,
  total_batches INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_group_executions_run
  ON stage_group_executions(run_id);
