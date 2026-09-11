-- Chaos module tables

CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    scope VARCHAR(255) NOT NULL,
    faults JSONB,
    steady_state_hypothesis TEXT,
    auto_rollback BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'created',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
-- 补齐 experiments：109_create_chaos-enhanced_tables.sql 的定义晚于 019_create_chaos_tables.sql，按序执行时表已存在
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS environment_id VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS fault_spec VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS target_id VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE, ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE, ADD COLUMN IF NOT EXISTS recovery_info VARCHAR(255), ADD COLUMN IF NOT EXISTS metadata JSONB, ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;


CREATE INDEX IF NOT EXISTS idx_experiments_tenant_id ON experiments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);

CREATE TABLE IF NOT EXISTS experiment_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    experiment_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_experiment_runs_tenant_id ON experiment_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_experiment_runs_experiment_id ON experiment_runs(experiment_id);
