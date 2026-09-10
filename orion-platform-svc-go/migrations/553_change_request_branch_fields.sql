-- Migration: 553_change_request_branch_fields
-- Created: 2026-09-10
-- Task: MB-P0-4 ChangeManagement 分支字段扩展
--
-- ALTER change_requests to add:
--   1) Branch-related fields (task requirement): branch / target_env / image_digest / approval_id
--   2) Missing columns referenced by internal/change repository INSERT &
--      dynamic WHERE but absent from the base table (migration 018):
--      change_type / priority / assigned_to / requester_id.
--
-- All columns are additive (ALTER TABLE ADD COLUMN IF NOT EXISTS), safe for
-- the other modules sharing change_requests (internal/change-request uses
-- `type`; internal/config uses config_id/requested_by/approved_by/reject_reason).

ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS branch VARCHAR(200);
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS target_env VARCHAR(100);
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS image_digest VARCHAR(200);
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS approval_id UUID;

-- Missing base columns referenced by internal/change (keep in sync with models.go)
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS change_type VARCHAR(50);
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS priority VARCHAR(50);
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(200);
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS requester_id VARCHAR(200);

-- Query filters used by internal/change ListChangeRequests
CREATE INDEX IF NOT EXISTS idx_change_requests_branch ON change_requests (tenant_id, branch);
CREATE INDEX IF NOT EXISTS idx_change_requests_target_env ON change_requests (tenant_id, target_env);
CREATE INDEX IF NOT EXISTS idx_change_requests_approval ON change_requests (tenant_id, approval_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_priority ON change_requests (tenant_id, priority);
CREATE INDEX IF NOT EXISTS idx_change_requests_assigned_to ON change_requests (tenant_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_change_requests_requester_id ON change_requests (tenant_id, requester_id);
