-- Pipeline Run 执行状态持久化表
-- 用于在服务重启后恢复未完成的 Pipeline 运行
-- 实现: Phase 3 Task 1 - Pipeline 执行状态持久化

CREATE TABLE IF NOT EXISTS pipeline_run_state (
  id VARCHAR(255) PRIMARY KEY,
  run_id VARCHAR(255) NOT NULL UNIQUE,
  pipeline_id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'running',
  current_stage_id VARCHAR(255),
  stage_results JSONB DEFAULT '{}',
  task_results JSONB DEFAULT '{}',
  stage_states JSONB DEFAULT '[]',
  execution_model JSONB,
  yaml_context JSONB,
  env_overrides JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1 NOT NULL
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_pipeline_run_state_run_id ON pipeline_run_state(run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_run_state_pipeline_id ON pipeline_run_state(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_run_state_status ON pipeline_run_state(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_run_state_tenant_id ON pipeline_run_state(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_run_state_created_at ON pipeline_run_state(created_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_run_state_running ON pipeline_run_state(status) WHERE status IN ('running', 'pending');