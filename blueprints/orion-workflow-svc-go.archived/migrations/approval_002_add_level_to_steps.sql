-- Add level column to approval_steps for multi-level approval tracking
ALTER TABLE approval_steps ADD COLUMN IF NOT EXISTS level INT NOT NULL DEFAULT 0;

-- Add level_config JSONB to approvals to store per-level required_approvals
-- Format: [{"level": 0, "required_approvals": 2}, {"level": 1, "required_approvals": 1}]
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS level_config JSONB;
