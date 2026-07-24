-- Migration 435: Create stage_states table

-- Stage runtime state persistence for crash recovery and observability
CREATE TABLE IF NOT EXISTS stage_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    error TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(stage_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_states_run ON stage_states(run_id);
CREATE INDEX IF NOT EXISTS idx_stage_states_status ON stage_states(status);
