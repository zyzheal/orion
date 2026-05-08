-- Migration 133: Pipeline Checkpoints for Execution State Persistence
-- 支持 Pipeline 执行状态持久化与 startup recovery

CREATE TABLE IF NOT EXISTS pipeline_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(36) NOT NULL UNIQUE,
    pipeline_id VARCHAR(36) NOT NULL,
    checkpoint_data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    last_stage_name VARCHAR(255),
    last_task_name VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_checkpoints_status ON pipeline_checkpoints(status);
CREATE INDEX idx_pipeline_checkpoints_run_id ON pipeline_checkpoints(run_id);
CREATE INDEX idx_pipeline_checkpoints_pipeline_id ON pipeline_checkpoints(pipeline_id);

COMMENT ON TABLE pipeline_checkpoints IS 'Pipeline execution checkpoints for crash recovery and state persistence';
