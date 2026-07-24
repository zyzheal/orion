-- Approval Gates 持久化表
-- 为 Pipeline 人工审批网关提供持久化存储，支持乐观锁并发控制

CREATE TABLE IF NOT EXISTS approval_gates (
  id VARCHAR(255) PRIMARY KEY,
  run_id VARCHAR(255) NOT NULL,
  stage_id VARCHAR(255) NOT NULL,
  stage_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  approvers JSONB NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  responded_by VARCHAR(255),
  response_comment TEXT,
  tenant_id VARCHAR(255),
  version INTEGER DEFAULT 1 NOT NULL
);

-- 乐观锁版本控制（如果列已存在则跳过）
-- ALTER TABLE approval_gates ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_approval_gates_run_id ON approval_gates(run_id);
CREATE INDEX IF NOT EXISTS idx_approval_gates_status ON approval_gates(status);
CREATE INDEX IF NOT EXISTS idx_approval_gates_run_stage ON approval_gates(run_id, stage_id) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_approval_gates_created_at ON approval_gates(created_at);
CREATE INDEX IF NOT EXISTS idx_approval_gates_expires ON approval_gates(created_at) WHERE status = 'pending';