-- Migration #054: Create ai_training_jobs table
-- AI Python Phase 1.3: Track model fine-tuning and training jobs

CREATE TABLE IF NOT EXISTS ai_training_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    job_name VARCHAR(255) NOT NULL,
    base_model VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, cancelled
    training_config JSONB DEFAULT '{}',
    dataset_config JSONB DEFAULT '{}',
    metrics JSONB DEFAULT '{}',
    error_message TEXT DEFAULT '',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_training_jobs_tenant ON ai_training_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_jobs_status ON ai_training_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_training_jobs_model ON ai_training_jobs(base_model);
CREATE INDEX IF NOT EXISTS idx_ai_training_jobs_tenant_status ON ai_training_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_training_jobs_created ON ai_training_jobs(created_at DESC);