-- Migration 058: Add required_approvals to approvals table
-- Supports "N out of M" approval model (e.g., any 2 of 5 approvers)

ALTER TABLE approvals ADD COLUMN IF NOT EXISTS required_approvals INT NOT NULL DEFAULT 1;

-- Set existing rows to match total_steps (preserves sequential behavior)
UPDATE approvals SET required_approvals = total_steps WHERE total_steps > 1;
