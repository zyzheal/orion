-- Rollback: 553_change_request_branch_fields
-- Created: 2026-09-10
-- Task: MB-P0-4 ChangeManagement 分支字段扩展

DROP INDEX IF EXISTS idx_change_requests_branch;
DROP INDEX IF EXISTS idx_change_requests_target_env;
DROP INDEX IF EXISTS idx_change_requests_approval;
DROP INDEX IF EXISTS idx_change_requests_priority;
DROP INDEX IF EXISTS idx_change_requests_assigned_to;
DROP INDEX IF EXISTS idx_change_requests_requester_id;

ALTER TABLE change_requests DROP COLUMN IF EXISTS branch;
ALTER TABLE change_requests DROP COLUMN IF EXISTS target_env;
ALTER TABLE change_requests DROP COLUMN IF EXISTS image_digest;
ALTER TABLE change_requests DROP COLUMN IF EXISTS approval_id;

ALTER TABLE change_requests DROP COLUMN IF EXISTS change_type;
ALTER TABLE change_requests DROP COLUMN IF EXISTS priority;
ALTER TABLE change_requests DROP COLUMN IF EXISTS assigned_to;
ALTER TABLE change_requests DROP COLUMN IF EXISTS requester_id;
